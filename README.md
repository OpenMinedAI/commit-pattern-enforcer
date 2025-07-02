# commit-pattern-enforcer

commit-pattern-enforcer - A flexible GitHub Action that validates commit messages against custom regex patterns to enforce consistent commit message standards across your repository.

## Features
- Enforces custom commit message patterns using regex
- Supports both push and pull request events
- Configurable for all commits or just the latest
- Case sensitivity and custom error messages
- Written in Python for easy customization

## Usage
Add the following to your workflow (e.g. `.github/workflows/commit-lint.yml`):

```yaml
name: Commit Message Lint
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  lint-commits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate commit messages
        uses: haseebrehanaziz/commit-pattern-enforcer@v1
        with:
          pattern: '^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+'
          pattern-description: 'Conventional Commits format: type(scope): description'
          check-all-commits: 'false'
          case-sensitive: 'true'
          fail-on-error: 'true'
          custom-error-message: ''
```

## Inputs
| Name                  | Description                                                      | Default                                                      |
|-----------------------|------------------------------------------------------------------|--------------------------------------------------------------|
| pattern               | Regex pattern to validate commit messages                        | '^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+' |
| pattern-description   | Description of the expected commit message format                | 'Conventional Commits format: type(scope): description'      |
| check-all-commits     | Whether to check all commits or just the latest                  | 'false'                                                      |
| case-sensitive        | Whether the pattern matching should be case sensitive            | 'true'                                                       |
| fail-on-error         | Whether to fail the action if validation fails                   | 'true'                                                       |
| custom-error-message  | Custom error message to display when validation fails            | ''                                                           |

## Outputs
| Name            | Description                                      |
|-----------------|--------------------------------------------------|
| valid           | Whether all commit messages passed validation     |
| failed-commits  | JSON array of commit messages that failed        |
| total-commits   | Total number of commits checked                  |

## License
MIT

---

For more details, see [action.yml](action.yml).
