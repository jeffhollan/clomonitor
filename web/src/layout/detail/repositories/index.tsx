import { isUndefined } from 'lodash';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';
import { GoLink } from 'react-icons/go';
import { HiExclamation } from 'react-icons/hi';
import { VscGithub } from 'react-icons/vsc';
import { useLocation, useNavigate } from 'react-router-dom';

import { CATEGORY_ICONS } from '../../../data';
import { CheckSet, Repository, ScoreType } from '../../../types';
import sortRepos from '../../../utils/sortRepos';
import CheckSetBadge from '../../common/badges/CheckSetBadge';
import CodeBlock from '../../common/CodeBlock';
import ExternalLink from '../../common/ExternalLink';
import RoundScore from '../../common/RoundScore';
import Row from '../report/Row';
import styles from './RepositoriesList.module.css';
import Summary from './Summary';

interface Props {
  repositories: Repository[];
  scrollIntoView: (id?: string) => void;
}

const RepositoriesList = (props: Props) => {
  const { hash, state, pathname } = useLocation();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);

  const getAnchorLink = (anchorName: string, className?: string): JSX.Element => (
    <button
      onClick={() => {
        props.scrollIntoView(`#${anchorName}`);
        navigate(
          {
            pathname: pathname,
            hash: `${anchorName}`,
          },
          { state: state }
        );
      }}
      className={`btn btn-link text-reset text-center lh-1 ${styles.headingLink} ${className}`}
      aria-label={`Link to anchor ${anchorName}`}
    >
      <GoLink />
    </button>
  );

  useEffect(() => {
    setRepositories(sortRepos(props.repositories));
  }, [props.repositories]);

  useEffect(() => {
    let timer: NodeJS.Timer | undefined;

    const cleanInterval = () => {
      if (!isUndefined(timer)) {
        clearInterval(timer);
      }
    };

    if (hash === '') {
      window.scrollTo(0, 0);
    } else {
      // We need to check if element is in the DOM
      timer = setInterval(() => {
        if (ref && ref.current) {
          props.scrollIntoView();
          cleanInterval();
        }
      }, 50);
    }

    return () => {
      cleanInterval();
    };
  }, []); /* eslint-disable-line react-hooks/exhaustive-deps */

  if (repositories.length === 0) return null;

  return (
    <div ref={ref}>
      <div className="my-3">
        <div className="text-center text-md-start text-uppercase h5 text-secondary fw-bold mb-3 mb-md-4">
          Repositories
        </div>
      </div>

      {/* Summary - only when more than 1 repository */}
      {repositories.length > 1 && <Summary repositories={repositories} scrollIntoView={props.scrollIntoView} />}

      {repositories.map((repo: Repository) => {
        return (
          <div
            data-testid="repository-info"
            key={`repo_${repo.repository_id}`}
            className="mb-4 mb-md-5 position-relative"
          >
            <div id={repo.name} className={`position-absolute ${styles.headerAnchor}`} />

            <div className={`border px-3 py-2 px-md-4 py-md-4 mb-2 ${styles.headerWrapper}`}>
              <div className="d-flex flex-row flex-md-row-reverse align-items-center">
                <div className="mx-0 mx-md-1 flex-grow-1 truncateWrapper position-relative">
                  <div className="d-none d-md-block">
                    <div className={`d-inline-flex flex-row align-items-center h4 fw-bold mb-2 ${styles.titleWrapper}`}>
                      <div className="text-truncate">{repo.name}</div>
                      <CheckSetBadge checkSets={repo.check_sets} className={`ms-2 ${styles.checkSetBadge}`} />
                      {getAnchorLink(repo.name)}
                    </div>
                    <ExternalLink href={repo.url}>
                      <div className={`d-flex flex-row align-items-center ${styles.link}`}>
                        <VscGithub className="me-1" />
                        <div>{repo.url}</div>
                      </div>
                    </ExternalLink>
                  </div>
                  <div className="d-block d-md-none">
                    <div className="d-flex flex-row align-items-center">
                      <ExternalLink href={repo.url} className={`fw-bold text-truncate ${styles.repoName}`}>
                        <div className="text-truncate">{repo.name}</div>
                      </ExternalLink>
                      {getAnchorLink(repo.name)}
                    </div>
                    <CheckSetBadge checkSets={repo.check_sets} />
                  </div>
                </div>
                <div className="ms-3 ms-md-0 me-0 me-md-3">
                  <RoundScore score={repo.score.global!} className={styles.global} />
                </div>
              </div>
            </div>
            <div>
              {repo.report.errors && repo.report.errors !== '' && (
                <div className="my-2">
                  <div className={`alert alert-warning mb-0 rounded-0 ${styles.alert}`} role="alert">
                    <div className="alert-heading mb-3">
                      <HiExclamation className="me-2" />
                      <span className="fw-bold">
                        Something went wrong processing this repository {moment.unix(repo.report.updated_at).fromNow()}
                      </span>
                    </div>
                    <CodeBlock language="bash" content={repo.report.errors} withCopyBtn={false} darkCode />
                  </div>
                </div>
              )}
              <Row
                repoName={repo.name}
                reportId={repo.report.report_id}
                name={ScoreType.Documentation}
                label="Documentation"
                data={repo.report.data.documentation}
                icon={CATEGORY_ICONS[ScoreType.Documentation]}
                score={repo.score.documentation}
                referenceUrl="https://github.com/cncf/clomonitor/blob/main/docs/checks.md#documentation"
                recommendedTemplates={
                  repo.check_sets && repo.check_sets.includes(CheckSet.Community)
                    ? [
                        {
                          name: 'CONTRIBUTING.md',
                          url: 'https://github.com/cncf/project-template/blob/main/CONTRIBUTING.md',
                        },
                        {
                          name: 'GOVERNANCE.md',
                          url: 'https://github.com/cncf/project-template/blob/main/GOVERNANCE.md',
                        },
                      ]
                    : undefined
                }
                getAnchorLink={getAnchorLink}
              />
              <Row
                repoName={repo.name}
                reportId={repo.report.report_id}
                name={ScoreType.License}
                label="License"
                data={repo.report.data.license}
                icon={CATEGORY_ICONS[ScoreType.License]}
                score={repo.score.license}
                referenceUrl="https://github.com/cncf/clomonitor/blob/main/docs/checks.md#license"
                getAnchorLink={getAnchorLink}
              />
              <Row
                repoName={repo.name}
                reportId={repo.report.report_id}
                name={ScoreType.BestPractices}
                label="Best Practices"
                data={repo.report.data.best_practices}
                icon={CATEGORY_ICONS[ScoreType.BestPractices]}
                score={repo.score.best_practices}
                referenceUrl="https://github.com/cncf/clomonitor/blob/main/docs/checks.md#best-practices"
                getAnchorLink={getAnchorLink}
              />
              <Row
                repoName={repo.name}
                reportId={repo.report.report_id}
                name={ScoreType.Security}
                label="Security"
                data={repo.report.data.security}
                icon={CATEGORY_ICONS[ScoreType.Security]}
                score={repo.score.security}
                referenceUrl="https://github.com/cncf/clomonitor/blob/main/docs/checks.md#security"
                recommendedTemplates={[
                  {
                    name: 'SECURITY.md',
                    url: 'https://github.com/cncf/tag-security/blob/main/project-resources/templates/SECURITY.md',
                  },
                ]}
                getAnchorLink={getAnchorLink}
              />
              <Row
                repoName={repo.name}
                reportId={repo.report.report_id}
                name={ScoreType.Legal}
                label="Legal"
                data={repo.report.data.legal}
                icon={CATEGORY_ICONS[ScoreType.Legal]}
                score={repo.score.legal}
                referenceUrl="https://github.com/cncf/clomonitor/blob/main/docs/checks.md#legal"
                getAnchorLink={getAnchorLink}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RepositoriesList;
