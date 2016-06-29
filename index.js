'use strict';

var _ = require('lodash'),
    request = require('request'),
    Promise = require('bluebird');

function retryDelay(count) {
    return Math.floor((Math.pow(2, count) + Math.random()) * 1000);
}

/*
 * @param {Object} options
 * @param {string} url - the url to request
 * @param {string} [userAgent]
 * @param {string} [oauthKey] - a GitHub oauth key with access to the repository being queried
 * @param {boolean} [retry] - retry on status code 202
 * @param {number} [retryCount]
 */
function requestPromise(options) {
    options = options || {};
    var headers = {'User-Agent': options.userAgent || 'request'};

    if (options.oauthKey) {
        headers.Authorization = 'token ' + options.oauthKey;
    }

    return new Promise(function (resolve, reject) {
        request({
            url: options.url,
            json: true,
            headers: headers
        }, function (error, response, body) {
            if (error) {
                return reject(error);
            }

            // Check response headers for pagination links
            var links = response.headers.link,
                nextPageUrl = '';

            if (links && _.includes(links, 'next')) {
                nextPageUrl = links.substring(1, links.indexOf('>; rel="next'));
            }

            if (error) {
                return reject(error);
            }

            function decorateError(error) {
                if (!error) {
                    throw new Error('error is required.');
                }

                error.url = options.url;
                error.http_status = response.statusCode;
                error.ratelimit_limit = response.headers['x-ratelimit-limit'];
                error.ratelimit_remaining = response.headers['x-ratelimit-remaining'];
                error.ratelimit_reset = parseInt(response.headers['x-ratelimit-reset'], 10);

                return error;
            }

            if (response.statusCode >= 500) {
                return reject(decorateError(new Error('Server error on url ' + options.url)));
            }
            if (response.statusCode >= 400) {
                return reject(decorateError(new Error('Client error on url ' + options.url)));
            }
            if (response.statusCode === 202) {
                if (!options.retry || options.retryCount > 4) {
                    return reject(decorateError(new Error('API returned status 202. Try again in a few moments.')));
                }

                var retryCount = parseInt(options.retryCount, 10) || 0,
                    retryPromise = Promise.delay(retryDelay(retryCount)).then(function () {
                    return requestPromise({
                        url: options.url,
                        userAgent: options.userAgent || 'request',
                        oauthKey: options.oauthKey,
                        retry: true,
                        retryCount: retryCount + 1
                    });
                });

                return resolve(retryPromise);
            }
            return resolve([body, nextPageUrl]);
        });
    });
}

function getPagination(_commits, _options) {
    var commits, options;

    if (!_options) {
        options = _commits;
        commits = [];
    } else {
        commits = _commits;
        options = _options;
    }

    return requestPromise(options).then(function (results) {
        var indexOfLastSha = _.findIndex(results[0], ['sha', options.commit]);

        if (indexOfLastSha < 0) {
            commits = commits.concat(results[0]);

            if (results[1]) {
                options.url = results[1];
                return getPagination(commits, options);
            }

            return commits;
        }

        return commits.concat(_.slice(results[0], 0, indexOfLastSha + 1));
    });
}

function getContribList(commits, removeGreenkeeper) {
    commits = _(commits).filter(function (c) {
        var isValidCommit = (c.parents.length === 1 && c.author);

        if (removeGreenkeeper && isValidCommit) {
            return c.author.login !== 'greenkeeperio-bot';
        }

        return isValidCommit;
    })

    .map(function (c) {
        return {
            id: c.author.login,
            name: c.commit.author.name
        };
    })

    .reduce(function (contributors, commit) {
        var index = _.findIndex(contributors, {id: commit.id});

        if (index > -1) {
            contributors[index].commitCount += 1;
        } else {
            contributors.push({
                id: commit.id,
                name: commit.name,
                commitCount: 1
            });
        }
        return contributors;
    }, []);

    return _.orderBy(commits, ['commitCount'], ['desc']);
}

function main(options) {
    options = options || {};
    var user = options.user,
        repo = options.repo,
        commit = options.commit,
        oauthKey = options.oauthKey,
        removeGreenkeeper = options.removeGreenkeeper,
        queryParams = '?page=1&per_page=100';

    if (options.to) {
        queryParams += '&sha=' + options.to;
    }

    if (!(user && repo && commit)) {
        throw new Error('Must specify a github user, repo, and commit SHA');
    }

    var repoApiUrl = ['https://api.github.com/repos', user, repo, 'commits'].join('/'),
        paginationPromise = getPagination({
            url: repoApiUrl + queryParams,
            userAgent: user,
            commit: commit,
            oauthKey: oauthKey,
            retry: options.retry
        });

    return Promise.join(paginationPromise, removeGreenkeeper, getContribList);
}

main.getContribList = getContribList;
module.exports = main;
