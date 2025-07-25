# Claude Code Agent Instructions

## Git Commit Requirements

### Mandatory Git Commits
All changes made by the Claude Code agent must be committed to git with descriptive commit messages. This ensures:
- Complete change tracking and history
- Ability to revert specific changes if needed
- Clear documentation of implementation progress
- Collaboration transparency

### Commit Message Format
Use conventional commit format with clear, descriptive messages:

```
<type>: <description>

[optional body explaining the change]
```

**Examples:**
```bash
git commit -m "feat: add OpenRouteService API integration with polyline decoder"
git commit -m "refactor: extract elevation service into separate module"
git commit -m "fix: resolve CORS issues in Vercel serverless functions"
git commit -m "docs: update PLAN.md with API rate limiting strategy"
git commit -m "chore: add .gitignore entries for environment variables"
```

### Commit Types
- **feat**: New features or functionality
- **fix**: Bug fixes
- **refactor**: Code refactoring without changing functionality
- **docs**: Documentation changes
- **style**: Code style/formatting changes
- **test**: Adding or modifying tests
- **chore**: Build process, dependency updates, config changes

### When to Commit
Create commits at logical breakpoints:
- After completing a specific feature or component
- After fixing a bug or issue
- After refactoring a significant piece of code
- After updating documentation
- Before starting work on a new major feature

**Do NOT** create commits for:
- Incomplete or broken functionality
- Experimental code that doesn't work
- Temporary debugging code

## Plan Documentation Updates

### Plan Deviation Protocol
If implementation deviates from PLAN.md or requires additional work not outlined in the plan:

1. **Update PLAN.md immediately** with the changes/additions
2. **Document the reason** for the deviation in the commit message
3. **Add new tasks** to the Implementation Plan section if needed
4. **Update success criteria** if scope changes significantly

### Required Plan Updates
Update PLAN.md when:
- Adding new features not in the original plan
- Changing technical architecture decisions
- Discovering new requirements during implementation
- Modifying the file structure significantly
- Adding new dependencies or external services
- Changing API endpoints or data structures

### Plan Update Examples
```bash
# After discovering need for route caching
git commit -m "feat: add route caching system

- Implement localStorage caching for generated routes
- Add cache invalidation after 24 hours
- Update PLAN.md with caching requirements and implementation details"

# After changing from OpenAI to local AI evaluation
git commit -m "refactor: replace OpenAI with local route evaluation

- Implement local scoring algorithm to reduce API costs
- Update PLAN.md to reflect new AI strategy
- Remove OpenAI dependency from backend procedure"
```

## Implementation Guidelines

### Code Quality Standards
- Follow existing code patterns and conventions from old_code versions
- Maintain consistent naming conventions
- Add error handling for all API calls
- Include console logging for debugging
- Write self-documenting code with clear variable names

### Testing Requirements
- Test all new functionality thoroughly
- Verify mobile responsiveness
- Test with various route parameters and edge cases
- Validate API error handling
- Test offline functionality where applicable

### Documentation Maintenance
Keep these files updated as development progresses:
- **PLAN.md**: Overall project plan and architecture
- **BACKEND_PROCEDURE.md**: Backend setup and deployment steps
- **README.md**: Project setup and usage instructions (create if needed)

### Progress Tracking
- Use TodoWrite tool to track implementation progress
- Mark todos as completed only when fully implemented and tested
- Add new todos when discovering additional work
- Update todo priorities based on dependencies and user needs

## Communication Protocol

### Change Notifications
When making significant changes, provide clear summaries of:
- What was implemented
- Any deviations from the plan
- New functionality added
- Issues encountered and resolutions
- Next recommended steps

### File References
When referencing code changes, use the format:
`filename:line_number` for specific code locations

**Example:**
"Added polyline decoder function in `js/polylineDecoder.js:25-67`"

## Error Handling Protocol

### When Things Go Wrong
1. **Document the issue** in commit messages
2. **Revert to last working state** if necessary
3. **Update PLAN.md** with lessons learned
4. **Add error handling** to prevent similar issues
5. **Test thoroughly** before continuing

### Recovery Commands
```bash
# View recent commits
git log --oneline -10

# Revert last commit if needed
git revert HEAD

# Check current status
git status
```

## Final Notes

- Always prioritize working, tested code over speed of implementation
- When in doubt, create a commit and document the current state
- Keep commits focused on single logical changes
- Use descriptive commit messages that explain the "why" not just the "what"
- Maintain the project's security standards, especially regarding API keys

This file serves as the development contract for the Claude Code agent working on the Route Generator v5 project.