/* jshint expr:true */
var expect = require('chai').expect,
    nock = require('nock'),
    rewire = require('rewire'),

    contribList = rewire('../index.js');

describe('gh-contrib-list', function () {
    it('retry delay should be an exponential backoff in milliseconds', function () {
        var retryDelay = contribList.__get__('retryDelay');

        expect(retryDelay(0)).to.be.above(1000).and.below(2000);
        expect(retryDelay(1)).to.be.above(2000).and.below(3000);
        expect(retryDelay(2)).to.be.above(4000).and.below(5000);
        expect(retryDelay(3)).to.be.above(8000).and.below(9000);
        expect(retryDelay(4)).to.be.above(16000).and.below(17000);
    });

    describe('getPagination', function () {
        var getPagination = contribList.__get__('getPagination');

        afterEach(function () {
            nock.cleanAll();
        });

        it('should follow pagination links', function (done) {
            nock('https://api.github.com')
                .get('/repos/x/y/commits')
                .reply(
                    200,
                    {
                        id: 'acburdine',
                        name: 'Austin Burdine',
                        commitCount: 67
                    },
                    {
                        link: '<https://api.github.com/repositories/1234567/commits?page=2&per_page=100>; rel="next"'
                    }
                )
                .get('/repositories/1234567/commits?page=2&per_page=100')
                .reply(
                    200,
                    {
                        id: 'anotherUser',
                        name: 'Github User',
                        commitCount: 3
                    }
                );

            var opts = {
                url: 'http://api.github.com/repos/x/y/commits',
                userAgent: 'x'
            };

            getPagination(opts).then(function (results) {
                expect(results.length).to.equal(1);
                expect(results[0].id).to.equal('acburdine');

                done();
            }).catch(done);
        });
    });

    describe('getContribList', function () {
        var fixture = require(__dirname + '/fixtures.json');

        it('should return all unique contributors', function () {
            var result = contribList.getContribList(fixture);
            expect(result.length).to.equal(4);
        });

        it('should not return any greenkeeper commits if greenkeeper is disabled', function () {
            var result = contribList.getContribList(fixture, true);
            expect(result.length).to.equal(3);
        });

        it('should return the correct details for contributors (excluding merge commits)', function () {
            var result = contribList.getContribList(fixture, true);

            expect(result[0].commitCount).to.equal(7);
            expect(result[0].id).to.equal('kirrg001');
            expect(result[0].name).to.equal('Katharina Irrgang');
        });

        it('should return contributors in correct order', function () {
            var result = contribList.getContribList(fixture, true);
            expect(result[0].id).to.equal('kirrg001');
            expect(result[1].id).to.equal('kevinansfield');
            expect(result[2].id).to.equal('acburdine');
        });
    });

    describe('requestPromise', function () {
        var requestPromise = contribList.__get__('requestPromise');

        afterEach(function () {
            nock.cleanAll();
        });

        it('should reject on a status code of >= 500', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(500);

            requestPromise({url: 'http://example.com/'}).then(function () {
                done(new Error('expected requestPromise to reject but it did not'));
            }).catch(function (err) {
                expect(err).to.be.instanceof(Error);

                done();
            });
        });

        it('should reject on a status code of >= 400', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(404);

            requestPromise({url: 'http://example.com/'}).then(function () {
                done(new Error('expected requestPromise to reject but it did not'));
            }).catch(function (err) {
                expect(err).to.be.an.instanceof(Error);

                done();
            });
        });

        it('should return the response body on a status code of 200', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(200, {some: 'thing'});

            requestPromise({url: 'http://example.com/'}).then(function (response) {
                expect(response).to.exist;
                expect(response[0].some).to.exist;
                expect(response[0].some).to.equal('thing');

                done();
            }).catch(done);
        });

        it('should return the response body and pagination url if available on a status code of 200', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(200, {some: 'thing'}, {
                    link: '<https://api.github.com/repositories/8231436/commits?since=2015-05-08>; rel="next"'
                });

            requestPromise({url: 'http://example.com/'}).then(function (response) {
                expect(response).to.exist;
                expect(response[0].some).to.exist;
                expect(response[0].some).to.equal('thing');
                expect(response[1]).to.equal('https://api.github.com/repositories/8231436/commits?since=2015-05-08');

                done();
            }).catch(done);
        });

        it('should reject if status code is 202 and retry is not enabled', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(202);

            requestPromise({url: 'http://example.com/'}).then(function () {
                done(new Error('expected requestPromise to reject but it did not'));
            }).catch(function (err) {
                expect(err).to.be.an.instanceof(Error);

                done();
            });
        });

        it('should retry if status code is 202 and retry is enabled', function (done) {
            this.timeout(5000);

            nock('http://example.com')
                .get('/')
                .reply(202)
                .get('/')
                .reply(200, {r: 'retry worked'});

            requestPromise({url: 'http://example.com/', retry: true}).then(function (response) {
                expect(response).to.exist;
                expect(response[0].r).to.exist;
                expect(response[0].r).to.equal('retry worked');

                done();
            }).catch(done);
        });
    });
});
