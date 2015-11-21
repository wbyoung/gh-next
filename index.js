'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var GitHub = require('github');
var co = require('co');
var moment = require('moment');
var userhome = require('userhome');
var config = require(userhome('.gh-next.json'));

var TARGET_MILESTONE_NAME = 'next';

var github = new GitHub({
    debug: false,
    host: 'api.github.com',
    protocol: 'https',
    version: '3.0.0'
});

github.authenticate({
    type: 'oauth',
    token: config['github_token']
});

Promise.promisifyAll(github.issues);
Promise.promisifyAll(github.repos);

var moveExistingTargetMilestone = co.wrap(function *(user, repo, milestone) {
  var due = milestone['due_on'];
  var created = milestone['created_at']
  var state = milestone.state;
  var title = due ?
    `${new moment(due).format('ll')} release`.toLowerCase() :
    `untitled from ${new moment(due).format('ll')}`.toLowerCase();

  if (state === 'open' && milestone.open_issues === 0) {
    state = 'closed';
  }

  yield github.issues.updateMilestoneAsync({
    user: user,
    repo: repo,
    number: milestone.number,
    title: title,
    state: state,
  });
});

var createNewTargetMilestone = co.wrap(function *(user, repo, due) {
  yield github.issues.createMilestoneAsync({
    user: user,
    repo: repo,
    title: TARGET_MILESTONE_NAME,
    due_on: due,
  });
});

var run = co.wrap(function *(args) {
  if (args.length !== 2) {
    console.error('Usage: gh-next <user/repo> <due>');
    process.exit(1);
  }

  var parts = args[0].split('/');
  var user = parts[0];
  var repo = parts[1];
  var due = moment(args[1], ['MM-DD-YYYY', 'MM-DD', 'YYYY-MM-DD']).toDate();

  var milestones = yield github.issues.getAllMilestonesAsync({
    user: user,
    repo: repo,
  });

  var milestone = _.find(milestones, { title: TARGET_MILESTONE_NAME });

  if (!milestone) {
    console.error('No "next" milestone to move.');
    process.exit(1);
  }

  yield moveExistingTargetMilestone(user, repo, milestone);
  yield createNewTargetMilestone(user, repo, due);
});

module.exports.run = run;
