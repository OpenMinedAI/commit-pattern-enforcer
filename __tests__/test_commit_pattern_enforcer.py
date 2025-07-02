import os
import sys
import json
import tempfile
import pytest
from scripts.main import CommitValidator, GitHubAction

class DummyGitHubAction(GitHubAction):
    outputs = {}
    failed = False
    messages = []

    @staticmethod
    def set_output(name, value):
        DummyGitHubAction.outputs[name] = value

    @staticmethod
    def set_failed(message):
        DummyGitHubAction.failed = True
        DummyGitHubAction.messages.append(message)
        # Do not exit in tests

    @staticmethod
    def info(message):
        DummyGitHubAction.messages.append(message)

    @staticmethod
    def error(message):
        DummyGitHubAction.messages.append(message)

    @staticmethod
    def warning(message):
        DummyGitHubAction.messages.append(message)

@pytest.fixture(autouse=True)
def patch_github_action(monkeypatch):
    monkeypatch.setattr('scripts.main.GitHubAction', DummyGitHubAction)
    DummyGitHubAction.outputs = {}
    DummyGitHubAction.failed = False
    DummyGitHubAction.messages = []

def make_event_file(event: dict):
    fd, path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        json.dump(event, f)
    return path

def test_valid_commit(monkeypatch):
    event = {"commits": [{"message": "feat: add new feature", "id": "abc123"}]}
    path = make_event_file(event)
    monkeypatch.setenv('GITHUB_EVENT_NAME', 'push')
    monkeypatch.setenv('GITHUB_EVENT_PATH', path)
    monkeypatch.setenv('INPUT_PATTERN', r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+')
    monkeypatch.setenv('INPUT_CHECK_ALL_COMMITS', 'false')
    validator = CommitValidator()
    is_valid, failed = validator.validate_commits(validator.get_commits())
    assert is_valid
    assert failed == []

def test_invalid_commit(monkeypatch):
    event = {"commits": [{"message": "bad commit", "id": "def456"}]}
    path = make_event_file(event)
    monkeypatch.setenv('GITHUB_EVENT_NAME', 'push')
    monkeypatch.setenv('GITHUB_EVENT_PATH', path)
    monkeypatch.setenv('INPUT_PATTERN', r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+')
    monkeypatch.setenv('INPUT_CHECK_ALL_COMMITS', 'false')
    validator = CommitValidator()
    is_valid, failed = validator.validate_commits(validator.get_commits())
    assert not is_valid
    assert len(failed) == 1
    assert failed[0]['id'] == 'def456'

def test_multiple_commits_check_all(monkeypatch):
    event = {"commits": [
        {"message": "feat: add", "id": "a1"},
        {"message": "fix: bug", "id": "b2"},
        {"message": "bad msg", "id": "c3"}
    ]}
    path = make_event_file(event)
    monkeypatch.setenv('GITHUB_EVENT_NAME', ' ')
    monkeypatch.setenv('GITHUB_EVENT_NAME', 'push')
    monkeypatch.setenv('GITHUB_EVENT_PATH', path)
    monkeypatch.setenv('INPUT_PATTERN', r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+')
    monkeypatch.setenv('INPUT_CHECK_ALL_COMMITS', 'true')
    validator = CommitValidator()
    is_valid, failed = validator.validate_commits(validator.get_commits())
    assert not is_valid
    assert len(failed) == 1
    assert failed[0]['id'] == 'c3'

def test_no_commits(monkeypatch):
    event = {"commits": []}
    path = make_event_file(event)
    monkeypatch.setenv('GITHUB_EVENT_NAME', 'push')
    monkeypatch.setenv('GITHUB_EVENT_PATH', path)
    validator = CommitValidator()
    is_valid, failed = validator.validate_commits(validator.get_commits())
    assert is_valid
    assert failed == []

def test_case_insensitive(monkeypatch):
    event = {"commits": [{"message": "FEAT: ADD", "id": "abc123"}]}
    path = make_event_file(event)
    monkeypatch.setenv('GITHUB_EVENT_NAME', 'push')
    monkeypatch.setenv('GITHUB_EVENT_PATH', path)
    monkeypatch.setenv('INPUT_PATTERN', r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+')
    monkeypatch.setenv('INPUT_CASE_SENSITIVE', 'false')
    validator = CommitValidator()
    is_valid, failed = validator.validate_commits(validator.get_commits())
    assert is_valid
    assert failed == []
