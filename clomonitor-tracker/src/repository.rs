use anyhow::{format_err, Error};
use chrono::{DateTime, Duration, Utc};
use clomonitor_core::{
    linter::{lint, CheckSet, LintOptions, Report},
    score::{self, Score},
};
use deadpool_postgres::{Client as DbClient, Transaction};
use std::path::Path;
use std::time::Instant;
use tempdir::TempDir;
use tokio::process::Command;
use tokio_postgres::types::Json;
use tokio_postgres::Error as DbError;
use tracing::{debug, warn};
use uuid::Uuid;

/// A project's repository.
#[derive(Debug)]
pub(crate) struct Repository {
    repository_id: Uuid,
    url: String,
    check_sets: Vec<CheckSet>,
    digest: Option<String>,
    updated_at: DateTime<Utc>,
}

impl Repository {
    /// Get repository's id.
    pub(crate) fn id(&self) -> Uuid {
        self.repository_id
    }

    /// Track repository if it has changed since the last time it was tracked.
    /// This involves cloning the repository, linting it and storing the results.
    pub(crate) async fn track(
        &self,
        mut db: DbClient,
        github_token: Option<String>,
    ) -> Result<(), Error> {
        let start = Instant::now();

        // Process only if the repository has changed since the last time it
        // was tracked or if it hasn't been tracked in more than 1 day
        let remote_digest = self.get_remote_digest().await?;
        if let Some(digest) = &self.digest {
            if &remote_digest == digest && self.updated_at > Utc::now() - Duration::days(1) {
                return Ok(());
            }
        }

        debug!("tracking repository [id: {}]", self.repository_id);

        // Clone repository
        let tmp_dir = TempDir::new("clomonitor")?;
        self.clone(tmp_dir.path()).await?;

        // Lint repository
        let mut errors: Option<String> = None;
        let options = LintOptions {
            check_sets: self.check_sets.clone(),
            root: tmp_dir.into_path(),
            url: self.url.clone(),
            github_token,
        };
        let report = match lint(options).await {
            Ok(report) => Some(report),
            Err(err) => {
                warn!(
                    "error linting repository [id: {}]: {}",
                    self.repository_id,
                    err.to_string()
                );
                errors = Some(err.to_string());
                None
            }
        };

        // Store tracking results in database
        let tx = db.transaction().await?;
        self.store_report(&tx, &report, errors).await?;
        self.update_score(&tx, &report).await?;
        self.update_project_score(&tx).await?;
        self.update_digest(&tx, &remote_digest).await?;
        tx.commit().await?;

        debug!(
            "repository tracked in {}s [id: {}]",
            start.elapsed().as_secs(),
            self.repository_id
        );
        Ok(())
    }

    /// Get the remote digest of a repository.
    async fn get_remote_digest(&self) -> Result<String, Error> {
        let output = Command::new("git")
            .arg("ls-remote")
            .arg(&self.url)
            .arg("HEAD")
            .output()
            .await?;
        if !output.status.success() {
            return Err(format_err!("{}", String::from_utf8_lossy(&output.stderr)));
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.split_whitespace().next().unwrap().to_string())
    }

    /// Clone (shallow) the source git repo in the destination path provided.
    async fn clone(&self, dst: &Path) -> Result<(), Error> {
        let output = Command::new("git")
            .arg("clone")
            .arg("--depth=10")
            .arg(&self.url)
            .arg(dst)
            .output()
            .await?;
        if !output.status.success() {
            return Err(format_err!("{}", String::from_utf8_lossy(&output.stderr)));
        }
        Ok(())
    }

    /// Store the provided linter report.
    async fn store_report(
        &self,
        tx: &Transaction<'_>,
        report: &Option<Report>,
        errors: Option<String>,
    ) -> Result<(), Error> {
        match report {
            Some(report) => {
                tx.execute(
                    "
                    insert into report (data, errors, repository_id)
                    values ($1::jsonb, $2::text, $3::uuid)
                    on conflict (repository_id) do update
                    set
                        data = excluded.data,
                        errors = excluded.errors,
                        updated_at = current_timestamp;
                    ",
                    &[&Json(&report), &errors, &self.repository_id],
                )
                .await?;
            }
            None => {
                tx.execute(
                    "
                    insert into report (errors, repository_id)
                    values ($1::text, $2::uuid)
                    on conflict (repository_id) do update
                    set
                        errors = excluded.errors,
                        updated_at = current_timestamp;
                    ",
                    &[&errors, &self.repository_id],
                )
                .await?;
            }
        }

        Ok(())
    }

    /// Update repository's score based on the provided linter report.
    async fn update_score(
        &self,
        tx: &Transaction<'_>,
        report: &Option<Report>,
    ) -> Result<(), Error> {
        if let Some(report) = report {
            let score = score::calculate(report);
            tx.execute(
                "
                update repository set
                    score = $1::jsonb,
                    updated_at = current_timestamp
                where repository_id = $2::uuid;
                ",
                &[&Json(&score), &self.repository_id],
            )
            .await?;
        }

        Ok(())
    }

    /// Update project's score based on the project's repositories scores.
    async fn update_project_score(&self, tx: &Transaction<'_>) -> Result<(), Error> {
        // Get project's id and lock project's row
        let row = tx
            .query_one(
                "
                select project_id from project
                where project_id in (
                    select project_id from repository where repository_id = $1::uuid
                ) for update;
                ",
                &[&self.repository_id],
            )
            .await?;
        let project_id: Uuid = row.get("project_id");

        // Calculate project's score from the repositories' scores
        let mut repositories_scores = Vec::<Score>::new();
        let rows = tx
            .query(
                "
                select score from repository
                where repository_id in (
                    select repository_id from repository where project_id = $1::uuid
                );
                ",
                &[&project_id],
            )
            .await?;
        for row in rows {
            let score: Option<Json<Score>> = row.get("score");
            if let Some(Json(score)) = score {
                repositories_scores.push(score);
            }
        }

        // Update project's score and rating
        if !repositories_scores.is_empty() {
            let project_score = score::merge(repositories_scores);
            tx.execute(
                "
            update project set
                score = $1::jsonb,
                rating = $2::text,
                updated_at = current_timestamp
            where project_id = $3::uuid;
            ",
                &[
                    &Json(&project_score),
                    &project_score.rating().to_string(),
                    &project_id,
                ],
            )
            .await?;
        }

        Ok(())
    }

    /// Update repository's digest.
    async fn update_digest(&self, tx: &Transaction<'_>, digest: &str) -> Result<(), Error> {
        tx.execute(
            "update repository set digest = $1::text where repository_id = $2::uuid;",
            &[&digest, &self.repository_id],
        )
        .await?;
        Ok(())
    }
}

/// Get all repositories available in the database.
pub(crate) async fn get_all(db: DbClient) -> Result<Vec<Repository>, DbError> {
    debug!("getting repositories");
    let mut repositories: Vec<Repository> = Vec::new();
    let rows = db
        .query(
            "
            select
                repository_id,
                url,
                digest,
                to_json(check_sets) as check_sets,
                updated_at
            from repository
            ",
            &[],
        )
        .await?;
    for row in rows {
        let Json(check_sets): Json<Vec<CheckSet>> = row.get("check_sets");
        repositories.push(Repository {
            repository_id: row.get("repository_id"),
            url: row.get("url"),
            check_sets,
            digest: row.get("digest"),
            updated_at: row.get("updated_at"),
        });
    }
    Ok(repositories)
}
