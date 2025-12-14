# Deployment Strategy

This document outlines Morphic's deployment approach using GitHub Deployments with a pull-based GitOps model.

## Overview

Our deployment strategy leverages GitHub's native Deployments feature while maintaining security by avoiding self-hosted runners in production environments. We use a pull-based GitOps approach where a deployment agent polls GitHub for deployment instructions.

## Architecture

```
GitHub UI → GitHub Deployments API → Deployment Agent → Production Environment
```

### Components

1. **GitHub Actions** - Creates deployment records via GitHub API
2. **Deployment Agent** - Polls GitHub for pending deployments 
3. **Production Environment** - Isolated network with outbound-only connectivity

## GitHub Features Integration

### ✅ Native GitHub Features That Work

- **Deployments UI**: Environment tabs with deployment history and status
- **Rollback Support**: Re-run previous deployments directly from GitHub UI
- **Environment Protection**: Required reviewers, branch restrictions, wait timers
- **Mobile Access**: Deploy and monitor from GitHub mobile app
- **Status Integration**: Deployment status appears in PRs and commit history
- **Audit Trail**: Complete deployment history with user attribution

### ✅ API Rate Limits

- **Polling Frequency**: 30-second intervals recommended
- **Rate Limit**: 5,000 requests/hour (120 requests/hour for 30s polling)
- **Optimization**: Use conditional requests and exponential backoff

## Implementation Details

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options: ['staging', 'production']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Create deployment
        uses: actions/github-script@v7
        with:
          script: |
            const deployment = await github.rest.repos.createDeployment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.sha,
              environment: '${{ inputs.environment }}',
              auto_merge: false,
              required_contexts: [],
              description: 'Deployment from GitHub UI'
            });
```

### Deployment Agent

```python
# deployment-agent.py
import time
import requests
import subprocess
from github import Github

class DeploymentAgent:
    def __init__(self, github_token, repo_name):
        self.github = Github(github_token)
        self.repo = self.github.get_repo(repo_name)
    
    def poll_deployments(self):
        """Poll for pending deployments every 30 seconds"""
        while True:
            try:
                deployments = self.repo.get_deployments()
                for deployment in deployments:
                    if deployment.statuses().totalCount == 0:  # Pending
                        self.execute_deployment(deployment)
                        
                time.sleep(30)  # 30-second polling interval
                
            except Exception as e:
                print(f"Polling error: {e}")
                time.sleep(60)  # Longer wait on error
    
    def execute_deployment(self, deployment):
        """Execute the actual deployment"""
        # Update status to in_progress
        deployment.create_status(
            state='in_progress',
            description='Deployment started'
        )
        
        try:
            # Pull latest images and restart services
            result = subprocess.run([
                'docker-compose', 'pull', 
                '&&', 'docker-compose', 'up', '-d'
            ], capture_output=True)
            
            if result.returncode == 0:
                deployment.create_status(
                    state='success',
                    description='Deployment completed successfully',
                    target_url='https://morphs.io'
                )
            else:
                deployment.create_status(
                    state='failure',
                    description=f'Deployment failed: {result.stderr}'
                )
                
        except Exception as e:
            deployment.create_status(
                state='error',
                description=f'Deployment error: {str(e)}'
            )
```

## Security Considerations

### Network Isolation
- Production environment has outbound-only connectivity
- No inbound firewall holes required
- Agent initiates all connections to GitHub

### Access Control
- GitHub Personal Access Token with minimal scopes:
  - `repo:read` - Read repository data
  - `repo_deployment` - Create deployment statuses
- Token stored securely on production server

### Deployment Validation
- Agent validates deployment SHA exists in repository
- Environment-specific validation rules
- Automatic rollback on health check failures

## Operational Benefits

### Developer Experience
- **One-Click Deployments**: Deploy directly from GitHub UI
- **Mobile Support**: Deploy from anywhere using GitHub mobile
- **Rollback Safety**: Instant rollback to any previous deployment
- **Team Visibility**: Everyone sees deployment status in real-time

### Production Safety
- **No External Runners**: No GitHub Actions runners in production
- **Audit Trail**: Complete deployment history with user attribution  
- **Environment Protection**: Configurable approval workflows
- **Automated Rollback**: Health check failures trigger automatic rollback

### Integration Benefits
- **PR Integration**: Deployment status appears in pull requests
- **Slack/Teams**: Native GitHub notifications work out of the box
- **Status Badges**: Repository deployment status visible everywhere
- **Branch Protection**: Tie deployments to branch protection rules

## Environment Configuration

### Staging Environment
- **Auto-deploy**: All commits to `main` branch
- **No approval**: Immediate deployment
- **Health checks**: Basic service availability

### Production Environment  
- **Manual trigger**: Deploy via GitHub UI only
- **Required approval**: Team lead approval required
- **Comprehensive checks**: Full health check suite
- **Gradual rollout**: Blue-green deployment strategy

## Monitoring and Alerting

### Deployment Metrics
- Deployment frequency and duration
- Success/failure rates by environment
- Rollback frequency and reasons
- Time to recovery metrics

### Alert Integration
- Slack notifications on deployment start/complete/fail
- PagerDuty integration for production deployment failures
- Email summaries for weekly deployment reports

## Future Enhancements

### Planned Improvements
- **Progressive Deployments**: Canary releases with automatic traffic shifting
- **Integration Testing**: Automated smoke tests post-deployment  
- **Deployment Approval**: Multi-stage approval workflows
- **Disaster Recovery**: Cross-region deployment coordination

### Metrics and Analytics
- **Deployment Analytics**: GitHub deployment insights integration
- **Performance Tracking**: Deployment impact on application metrics
- **Cost Analysis**: Infrastructure cost attribution per deployment

## Troubleshooting

### Common Issues
- **Agent Connectivity**: Verify GitHub API access and token permissions
- **Docker Issues**: Check Docker daemon status and image availability
- **Network Problems**: Validate outbound connectivity to GitHub and registries

### Debug Commands
```bash
# Check agent logs
journalctl -u deployment-agent -f

# Manual deployment test
python deployment-agent.py --test-mode

# Validate GitHub connectivity
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/morphic-team/morphic/deployments
```

This deployment strategy provides enterprise-grade deployment capabilities while maintaining security and operational simplicity.