[![travis](https://travis-ci.org/acburdine/gh-contrib-list.svg?branch=master)](https://travis-ci.org/acburdine/gh-contrib-list)
[![npm](https://img.shields.io/npm/v/gh-contrib-list.svg)](https://npmjs.com/package/gh-contrib-list)
[![Dependency Status](https://david-dm.org/acburdine/gh-contrib-list.svg)](https://david-dm.org/acburdine/gh-contrib-list)

# gh-contrib-list

A tool to generate a list of contributors from a specific range of commits

## Usage:

```
npm install gh-contrib-list
```

In code:

```javascript
var ghContribList = require('gh-contrib-list');

ghContribList(options);
```

Returns a Promise with an array of contributors. Each contributor has the following properties:

- `id` - Github username of the contributor
- `name` - Full name of the contributor
- `commitCount` - Number of commits the person has contributed

### Options

- `user` - The user or organization (**required**)
- `repo` - The repository name (**required**)
- `commit` - A commit SHA to run the query from (commits including and after this one will be used) (**required**)
- `oauthKey` - If one is provided it will be used when making Github API requests
- `to` - If another commit SHA is provided here the commits used will be between the `commit` option and this one.
- `removeGreenkeeper` - If this is set to true, any commits by Greenkeeper will be automatically removed.
- `retry` - If this is set to true, the request will be retried in the event that the Github API returns a 202 status (retry momentarily).

---

## Credit:

This script is heavily based on [top-gh-contribs](https://github.com/novaugust/top-gh-contribs).
