{{ template "projects/get_project.sql" }}
{{ template "projects/search_projects.sql" }}
{{ template "stats/average_section_score.sql" }}
{{ template "stats/repositories_passing_check.sql" }}
{{ template "stats/get_stats.sql" }}

---- create above / drop below ----

-- Nothing to do
