module.exports = function(grunt) {

    // load all grunt tasks
    require('load-grunt-tasks')(grunt);

    var reloadPort = 35729;

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        concat: {
            options: {
                separator: "\n\n"
            },
            dist: {
                src: [
                    'src/litelist.js'
                ],
                dest: 'dist/<%= pkg.name.replace(".js", "") %>.js'
            },
            distRV: {
                src: [
                    'src/rvlitelist.js'
                ],
                dest: 'dist/rv<%= pkg.name.replace(".js", "") %>.js'
            },
            distBundled: {
                src: [
                    'bower_components/raf.js/raf.js',
                    'bower_components/tweenjs/src/Tween.js',
                    'src/litelist.js',
                    'src/rvlitelist.js',
                    'src/scroll.js'
                ],
                dest: 'dist/<%= pkg.name.replace(".js", "") %>.bundled.js'
            }
        },

        uglify: {
            options: {
                banner: '/*! <%= pkg.name.replace(".js", "") %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
            },
            dist: {
                files: {
                    'dist/<%= pkg.name.replace(".js", "") %>.min.js': ['<%= concat.dist.dest %>'],
                    'dist/rv<%= pkg.name.replace(".js", "") %>.min.js': ['<%= concat.distRV.dest %>'],
                    'dist/<%= pkg.name.replace(".js", "") %>.bundled.min.js': ['<%= concat.distBundled.dest %>']
                }
            }
        },

        qunit: {
            files: ['test/*.html']
        },

        jshint: {
            files: ['dist/litelist.js'],
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
                tasks: ['concat', 'jshint', 'qunit', 'uglify']
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
        /*
        watch: {
            files: ['src/litelist.js'],
            tasks: ['concat', 'jshint', 'qunit', 'uglify', 'connect']
        }
        */
    });

    grunt.registerTask('test', ['jshint', 'qunit']);
    grunt.registerTask('build', ['concat', 'jshint', 'qunit', 'uglify']);
    grunt.registerTask('default', ['connect', 'watch']);
};
