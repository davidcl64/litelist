module.exports = function(grunt) {

    // load all grunt tasks
    require('load-grunt-tasks')(grunt);

    var reloadPort   = 35729;
    var pkg          = grunt.file.readJSON('package.json');
    
    var distOpts = {
        bundled: pkg.name.replace(".js", "") + '.bundled.js',
        core:    pkg.name.replace(".js", "") + '.js',
        rivets:  'rv' + pkg.name.replace(".js", "") + '.js',
        scroll:  'scroll.js'
    };

    var browsers = [{
        browserName: "firefox",
        version: "19",
        platform: "XP"
    }, {
        browserName: "chrome",
        platform: "XP"
    }, {
        browserName: "chrome",
        platform: "linux"
    }, {
        browserName: "internet explorer",
        platform: "WIN8",
        version: "10"
    }, {
        browserName: "internet explorer",
        platform: "VISTA",
        version: "9"
    }, {
        browserName: "opera",
        platform: "Windows 2008",
        version: "12"
    }];

    grunt.initConfig({
        pkg:      pkg,
        distOpts: distOpts,
        uglifyOpts: { report: 'min' },

        browserify: {
            bundled: {
                // alias will both alias and expose require
                options: { alias: ['./src/litelist:LiteList', "rivets:rivets"] },
                files:   { 'dist/<%= distOpts.bundled %>': ['./src/bundled.js'] }
            },
            liteList: {
                options: { alias: ['./src/litelist:LiteList'] },
                files:   { 'dist/<%= distOpts.core %>': ['./src/litelist.js'] }
            },
            rvLiteList: {
                options: { alias: ['./src/litelist.js:LiteList', "rivets:rivets"] },
                files:   { 'dist/<%= distOpts.rivets %>': ['./src/rvlitelist.js'] }
            },
            scroll: {
                options: { alias: ['./src/scroll.js:LiteListScroll', 'tween.js:tween.js', 'tween.js:TWEEN'] },
                files:   { 'dist/<%= distOpts.scroll %>': ['./src/scroll.js'] }
            },
            tests: {
                options: {
                    alias: [
                        './src/litelist:LiteList',
                        './src/scroll:LiteListScroll',
                        'rivets:rivets',
                        'tween.js:tween.js',
                        'tween.js:TWEEN'
                    ]
                },
                files:   { 'test/suite.bundle.js': ['./test/tests.js'] }
            }
        },

        uglify: {
            options: {
                banner: '/*! <%= pkg.name.replace(".js", "") %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
                sourceMap: true,
                report: '<%= uglifyOpts.report %>'
            },
            dist: {
                files: {
                    'dist/<%= distOpts.bundled.replace(".js", "") %>.min.js': ['dist/<%= distOpts.bundled %>'],
                    'dist/<%= distOpts.core   .replace(".js", "") %>.min.js': ['dist/<%= distOpts.core    %>'],
                    'dist/<%= distOpts.rivets .replace(".js", "") %>.min.js': ['dist/<%= distOpts.rivets  %>'],
                    'dist/<%= distOpts.scroll .replace(".js", "") %>.min.js': ['dist/<%= distOpts.scroll  %>']
                }
            }
        },

        mocha: {
            test: {
                src: ['test/index.html'],
                options: {
                    run: true,
                    reporter: 'Spec'
                }
            }
        },

        'saucelabs-mocha': {
            all: {
                options: {
                    urls: ["http://127.0.0.1:9001/test/index.html"],
                    tunnelTimeout: 5,
                    detailedErrors: true,
                    "capture-html": true,
                    build: process.env.TRAVIS_JOB_ID,
                    concurrency: 3,
                    browsers: browsers,
                    testname: "mocha tests",
                    tags: ["master"]
                }
            }
        },

        jshint: {
            files: ['src/**/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        connect: {
            server: {
                options: {
                    livereload: reloadPort,
                    port: 9001,
                    base: ['.', 'demo', 'dist', 'bower_components']
                }
            }
        },

        watch: {
            options: {
                nospawn: true,
                livereload: reloadPort
            },
            js: {
                files: ['src/*.js', 'test/tests.js'],
                options: {
                    livereload: reloadPort
                },
                tasks: ['build:min']
            },
            css: {
                files: ['demo/assets/*.css'],
                options: {
                    livereload: reloadPort
                }
            },
            html: {
                files: ['demo/*.html'],
                options: {
                    livereload: reloadPort
                }
            }
        }
    });

    grunt.registerTask('test', ['jshint', 'mocha']);
    grunt.registerTask('default', ['connect', 'watch']);

    grunt.registerTask("testSauce", ["browserify", "connect", "saucelabs-mocha"]);

    // Allow caller to specify reporting.  Watch calls with 'min' for
    // faster build times.
    grunt.registerTask('build', 'Run all build tasks', function(_report) {
        grunt.config.set('uglifyOpts.report', _report || 'gzip');
        grunt.task.run('jshint', 'browserify', 'mocha', 'uglify');
    });
};
