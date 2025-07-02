const core = require('@actions/core');
const github = require('@actions/github');
const { run } = require('../src/index');

// Mock the action's dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');

describe('Commit Pattern Enforcer', () => {
  let getInputMock;
  let setOutputMock;
  let setFailedMock;
  let infoMock;
  let errorMock;
  let warningMock;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mocks
    getInputMock = jest.spyOn(core, 'getInput');
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation();
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation();
    infoMock = jest.spyOn(core, 'info').mockImplementation();
    errorMock = jest.spyOn(core, 'error').mockImplementation();
    warningMock = jest.spyOn(core, 'warning').mockImplementation();

    // Default input values
    getInputMock.mockImplementation((name) => {
      switch (name) {
        case 'pattern':
          return '^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\\(.+\\))?: .+';
        case 'pattern-description':
          return 'Conventional Commits format';
        case 'check-all-commits':
          return 'false';
        case 'case-sensitive':
          return 'true';
        case 'fail-on-error':
          return 'true';
        case 'custom-error-message':
          return '';
        default:
          return '';
      }
    });

    // Mock github context
    github.context = {
      eventName: 'push',
      payload: {
        commits: []
      },
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    };
  });

  test('should pass validation for valid conventional commit', async () => {
    github.context.payload.commits = [
      {
        message: 'feat: add new validation feature',
        id: 'abc123'
      }
    ];

    await run();

    expect(setOutputMock).toHaveBeenCalledWith('valid', true);
    expect(setOutputMock).toHaveBeenCalledWith('total-commits', 1);
    expect(setFailedMock).not.toHaveBeenCalled();
  });

  test('should fail validation for invalid commit message', async () => {
    github.context.payload.commits = [
      {
        message: 'invalid commit message',
        id: 'def456'
      }
    ];

    await run();

    expect(setOutputMock).toHaveBeenCalledWith('valid', false);
    expect(setOutputMock).toHaveBeenCalledWith('total-commits', 1);
    expect(setFailedMock).toHaveBeenCalled();
  });

  test('should handle multiple commits when check-all-commits is true', async () => {
    getInputMock.mockImplementation((name) => {
      if (name === 'check-all-commits') return 'true';
      // Return default values for other inputs
      return getInputMock.mockImplementation((name) => {
        switch (name) {
          case 'pattern':
            return '^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\\(.+\\))?: .+';
          case 'pattern-description':
            return 'Conventional Commits format';
          case 'case-sensitive':
            return 'true';
          case 'fail-on-error':
            return 'true';
          case 'custom-error-message':
            return '';
          default:
            return '';
        }
      })(name);
    });

    github.context.payload.commits = [
      {
        message: 'feat: add feature 1',
        id: 'abc123'
      },
      {
        message: 'fix: fix bug 1',
        id: 'def456'
      },
      {
        message: 'invalid message',
        id: 'ghi789'
      }
    ];

    await run();

    expect(setOutputMock).toHaveBeenCalledWith('valid', false);
    expect(setOutputMock).toHaveBeenCalledWith('total-commits', 3);
  });

  test('should handle case insensitive matching', async () => {
    getInputMock.mockImplementation((name) => {
      if (name === 'case-sensitive') return 'false';
      // Return default values for other inputs
      return getInputMock.mockImplementation((name) => {
        switch (name) {
          case 'pattern':
            return '^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\\(.+\\))?: .+';
          case 'pattern-description':
            return 'Conventional Commits format';
          case 'check-all-commits':
            return 'false';
          case 'fail-on-error':
            return 'true';
          case 'custom-error-message':
            return '';
          default:
            return '';
        }
      })(name);
    });

    github.context.payload.commits = [
      {
        message: 'FEAT: ADD NEW FEATURE',
        id: 'abc123'
      }
    ];

    await run();

    expect(setOutputMock).toHaveBeenCalledWith('valid', true);
  });

  test('should handle no commits gracefully', async () => {
    github.context.payload.commits = [];

    await run();

    expect(warningMock).toHaveBeenCalledWith('⚠️ No commits found to validate');
    expect(setOutputMock).toHaveBeenCalledWith('valid', true);
    expect(setOutputMock).toHaveBeenCalledWith('total-commits', 0);
  });

  test('should not fail action when fail-on-error is false', async () => {
    getInputMock.mockImplementation((name) => {
      if (name === 'fail-on-error') return 'false';
      // Return default values for other inputs
      return getInputMock.mockImplementation((name) => {
        switch (name) {
          case 'pattern':
            return '^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\\(.+\\))?: .+';
          case 'pattern-description':
            return 'Conventional Commits format';
          case 'check-all-commits':
            return 'false';
          case 'case-sensitive':
            return 'true';
          case 'custom-error-message':
            return '';
          default:
            return '';
        }
      })(name);
    });

    github.context.payload.commits = [
      {
        message: 'invalid commit message',
        id: 'def456'
      }
    ];

    await run();

    expect(setOutputMock).toHaveBeenCalledWith('valid', false);
    expect(setFailedMock).not.toHaveBeenCalled();
  });
});
