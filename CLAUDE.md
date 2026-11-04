# Project Health Dashboard: rules

## Git
- Commit author and committer must be `msisaif <61042251+msisaif@users.noreply.github.com>`. Use only this name and email.
- Commit messages must not contain attribution lines, such as `Co-Authored-By`, `Claude-Session`, or "Generated with Claude".
- Do not push unless the user says so in that conversation.

## Data
- `data/projects.json`: version info from each GitHub repo (PHP, Laravel, Node, database).
- `data/eol.json`: release and end-of-life dates for each product version.
- `index.html`: the dashboard page. It is stored in the Claude Artifact store, and this file is its copy.
