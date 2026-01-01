#!/bin/bash

# Script to create GitHub issue for mobile usability audit
# Run this script if you have the GitHub CLI installed

ISSUE_TITLE="Mobile Usability Audit: Text Readability and Touch Target Improvements"
ISSUE_BODY_FILE="github-issue-body.md"
LABELS="enhancement,mobile,ux,a11y"

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    echo "Creating GitHub issue..."
    gh issue create \
        --title "$ISSUE_TITLE" \
        --body-file "$ISSUE_BODY_FILE" \
        --label "$LABELS"
    echo "Issue created successfully!"
else
    echo "GitHub CLI (gh) not found."
    echo ""
    echo "Alternative: Create issue manually at:"
    echo "https://github.com/willjobs/sunshine-optimist/issues/new"
    echo ""
    echo "Title:"
    echo "$ISSUE_TITLE"
    echo ""
    echo "Body: (see github-issue-body.md)"
    echo ""
    echo "Labels: $LABELS"
fi
