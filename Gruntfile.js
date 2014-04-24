module.exports = function(grunt) {

    // load all grunt tasks
    require('load-grunt-tasks')(grunt);

    var reloadPort = 35729;
    var pkg = grunt.file.readJSON('package.json');

    var distOpts = {
        bundled: pkg.name.replace(".js", "") + '.bundled.js',
        core:    pkg.name.replace(".js", "") + '.js',
        rivets:  'rv' + pkg.name.replace(".js", "") + '.js',
        scroll:  'scroll.js'
    };

    grunt.initConfig({
        pkg:      pkg,
        distOpts: distOpts,

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
                options: { alias: ['./src/scroll.js:LiteListScroll'] },
                files:   { 'dist/<%= distOpts.scroll %>': ['./src/scroll.js'] }
            }
        },

        uglify: {
            options: {
                banner: '/*! <%= pkg.name.replace(".js", "") %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
                sourceMap: true
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

        qunit: {
            files: ['test/*.html']
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
                    base: ['demo', 'dist', 'bower_components']
                }
            }
        },

        watch: {
            options: {
                nospawn: true,
                livereload: reloadPort
            },
            js: {
                files: ['src/*.js'],
                options: {
                    livereload: reloadPort
                },
                tasks: ['jshint', 'browserify', 'qunit', 'uglify']
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

    grunt.registerTask('test', ['jshint', 'qunit']);
    grunt.registerTask('build', ['jshint', 'browserify', 'qunit', 'uglify']);
    grunt.registerTask('default', ['connect', 'watch']);
};
