#!/usr/bin/env python3
"""
Commit Pattern Enforcer - A GitHub Action to validate commit messages against regex patterns
"""

import os
import re
import json
import sys
import requests
from typing import List, Dict, Any, Optional


class GitHubAction:
    """Helper class for GitHub Actions functionality"""
    
    @staticmethod
    def get_input(name: str, required: bool = False, default: str = "") -> str:
        """Get input from environment variables"""
        env_name = f"INPUT_{name.upper().replace('-', '_')}"
        value = os.environ.get(env_name, default)
        
        if required and not value:
            GitHubAction.set_failed(f"Input required and not supplied: {name}")
            
        return value
    
    @staticmethod
    def set_output(name: str, value: Any) -> None:
        """Set output for the action"""
        output_file = os.environ.get('GITHUB_OUTPUT')
        if output_file:
            with open(output_file, 'a') as f:
                f.write(f"{name}={value}\n")
        else:
            print(f"::set-output name={name}::{value}")
    
    @staticmethod
    def set_failed(message: str) -> None:
        """Set the action as failed"""
        print(f"::error::{message}")
        sys.exit(1)
    
    @staticmethod
    def info(message: str) -> None:
        """Print info message"""
        print(f"::notice::{message}")
    
    @staticmethod
    def error(message: str) -> None:
        """Print error message"""
        print(f"::error::{message}")
    
    @staticmethod
    def warning(message: str) -> None:
        """Print warning message"""
        print(f"::warning::{message}")


class CommitValidator:
    """Main class for validating commit messages"""
    
    def __init__(self):
        self.pattern = GitHubAction.get_input('pattern', default=r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+')
        self.pattern_description = GitHubAction.get_input('pattern-description', default='Conventional Commits format: type(scope): description')
        self.check_all_commits = GitHubAction.get_input('check-all-commits', default='false').lower() == 'true'
        self.case_sensitive = GitHubAction.get_input('case-sensitive', default='true').lower() == 'true'
        self.fail_on_error = GitHubAction.get_input('fail-on-error', default='true').lower() == 'true'
        self.custom_error_message = GitHubAction.get_input('custom-error-message')
        
        # Compile regex pattern
        flags = 0 if self.case_sensitive else re.IGNORECASE
        try:
            self.regex = re.compile(self.pattern, flags)
        except re.error as e:
            GitHubAction.set_failed(f"Invalid regex pattern: {e}")
    
    def get_commits(self) -> List[Dict[str, str]]:
        """Get commits from GitHub event payload"""
        event_name = os.environ.get('GITHUB_EVENT_NAME')
        event_path = os.environ.get('GITHUB_EVENT_PATH')
        
        if not event_path or not os.path.exists(event_path):
            GitHubAction.warning("No event payload found")
            return []
        
        try:
            with open(event_path, 'r') as f:
                payload = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            GitHubAction.warning(f"Could not read event payload: {e}")
            return []
        
        commits = []
        
        if event_name == 'push':
            commits = payload.get('commits', [])
        elif event_name == 'pull_request':
            # For PR events, we need to fetch commits via API
            commits = self.get_pr_commits(payload)
        
        return commits
    
    def get_pr_commits(self, payload: Dict[str, Any]) -> List[Dict[str, str]]:
        """Get commits from a pull request"""
        github_token = os.environ.get('GITHUB_TOKEN')
        if not github_token:
            GitHubAction.warning("GITHUB_TOKEN not available, cannot fetch PR commits")
            return []
        
        repo_owner = payload['repository']['owner']['login']
        repo_name = payload['repository']['name']
        pr_number = payload['number']
        
        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}/commits"
        headers = {
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            pr_commits = response.json()
            
            return [
                {
                    'message': commit['commit']['message'],
                    'id': commit['sha']
                }
                for commit in pr_commits
            ]
        except requests.RequestException as e:
            GitHubAction.warning(f"Could not fetch PR commits: {e}")
            return []
    
    def validate_commits(self, commits: List[Dict[str, str]]) -> tuple[bool, List[Dict[str, str]]]:
        """Validate commit messages against the pattern"""
        if not commits:
            GitHubAction.warning("⚠️ No commits found to validate")
            return True, []
        
        # Determine which commits to check
        commits_to_check = commits if self.check_all_commits else [commits[-1]]
        
        GitHubAction.info(f"📊 Checking {len(commits_to_check)} commit(s)")
        
        failed_commits = []
        
        for commit in commits_to_check:
            message = commit.get('message', '')
            commit_id = commit.get('id', 'unknown')
            
            # Get first line of commit message for validation
            first_line = message.split('\n')[0].strip()
            
            GitHubAction.info(f"🔎 Checking commit {commit_id[:7]}: \"{first_line}\"")
            
            if not self.regex.search(first_line):
                failed_commits.append({
                    'id': commit_id,
                    'message': first_line,
                    'fullMessage': message
                })
                GitHubAction.error(f"❌ Commit {commit_id[:7]} failed validation: \"{first_line}\"")
            else:
                GitHubAction.info(f"✅ Commit {commit_id[:7]} passed validation")
        
        is_valid = len(failed_commits) == 0
        return is_valid, failed_commits
    
    def run(self) -> None:
        """Main execution function"""
        try:
            GitHubAction.info(f"🔍 Validating commit messages with pattern: {self.pattern}")
            GitHubAction.info(f"📝 Expected format: {self.pattern_description}")
            
            # Get commits
            commits = self.get_commits()
            
            # Validate commits
            is_valid, failed_commits = self.validate_commits(commits)
            
            # Set outputs
            GitHubAction.set_output('valid', str(is_valid).lower())
            GitHubAction.set_output('failed-commits', json.dumps(failed_commits))
            GitHubAction.set_output('total-commits', len(commits) if commits else 0)
            
            # Handle results
            if is_valid:
                total_checked = len(commits) if self.check_all_commits else min(1, len(commits))
                GitHubAction.info(f"🎉 All {total_checked} commit(s) passed validation!")
            else:
                error_msg = self.custom_error_message
                if not error_msg:
                    total_checked = len(commits) if self.check_all_commits else 1
                    error_msg = (
                        f"❌ {len(failed_commits)} out of {total_checked} commit(s) failed validation.\n"
                        f"Expected format: {self.pattern_description}\n"
                        f"Pattern: {self.pattern}\n\n"
                        f"Failed commits:\n" +
                        '\n'.join([f"- {c['id'][:7]}: \"{c['message']}\"" for c in failed_commits])
                    )
                
                GitHubAction.error(error_msg)
                
                if self.fail_on_error:
                    GitHubAction.set_failed(error_msg)
        
        except Exception as e:
            GitHubAction.set_failed(f"Action failed with error: {str(e)}")


def main():
    """Entry point"""
    validator = CommitValidator()
    validator.run()


if __name__ == "__main__":
    main()
