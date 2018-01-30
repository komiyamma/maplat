var gulp = require('gulp'),
    execSync = require('child_process').execSync,
    spawn = require('child_process').spawn,
    concat = require('gulp-concat'),
    header = require('gulp-header'),
    zip = require('gulp-zip'),
    os = require('os'),
    fs = require('fs-extra');

var pkg = require('./package.json');
var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''].join('\n');
var isWin = os.type().toString().match('Windows') !== null;

gulp.task('server', function(){
    return spawn('node', ['server.js'], {
        stdio: 'ignore',
        detached: true
    }).unref();
});

gulp.task('build', ['create_example'], function() {
    fs.removeSync('./example');
});

gulp.task('create_example', ['concat_promise'], function() {
    fs.unlinkSync('./js/maplat_withoutpromise.js');

    try {
        fs.removeSync('./example.zip');
    } catch (e) {
    }
    try {
        fs.removeSync('./example');
    } catch (e) {
    }

    fs.ensureDirSync('./example');
    fs.copySync('./js/maplat.js', './example/js/maplat.js');
    fs.copySync('./css', './example/css');
    fs.copySync('./locales', './example/locales');
    fs.copySync('./parts', './example/parts');
    fs.copySync('./apps/example_sample.json', './example/apps/sample.json');
    fs.copySync('./maps/morioka.json', './example/maps/morioka.json');
    fs.copySync('./maps/morioka_ndl.json', './example/maps/morioka_ndl.json');
    fs.copySync('./tiles/morioka', './example/tiles/morioka');
    fs.copySync('./tiles/morioka_ndl', './example/tiles/morioka_ndl');
    fs.copySync('./tmbs/morioka_menu.jpg', './example/tmbs/morioka_menu.jpg');
    fs.copySync('./tmbs/morioka_ndl_menu.jpg', './example/tmbs/morioka_ndl_menu.jpg');
    fs.copySync('./tmbs/osm_menu.jpg', './example/tmbs/osm_menu.jpg');
    fs.copySync('./tmbs/gsi_menu.jpg', './example/tmbs/gsi_menu.jpg');
    fs.copySync('./img/houonji.jpg', './example/img/houonji.jpg');
    fs.copySync('./img/ishiwari_zakura.jpg', './example/img/ishiwari_zakura.jpg');
    fs.copySync('./img/mitsuishi_jinja.jpg', './example/img/mitsuishi_jinja.jpg');
    fs.copySync('./img/moriokaginko.jpg', './example/img/moriokaginko.jpg');
    fs.copySync('./img/moriokajo.jpg', './example/img/moriokajo.jpg');
    fs.copySync('./img/sakurayama_jinja.jpg', './example/img/sakurayama_jinja.jpg');
    fs.copySync('./example.html', './example/index.html');

    return gulp.src(['./example/*', './example/*/*', './example/*/*/*', './example/*/*/*/*', './example/*/*/*/*/*'])
        .pipe(zip('example.zip'))
        .pipe(gulp.dest('./'));
});

gulp.task('concat_promise', ['build_withoutpromise'], function() {
    return gulp.src(['./js/aigle-es5.min.js', 'js/maplat_withoutpromise.js'])
        .pipe(concat('maplat.js'))
        .pipe(header(banner, {pkg: pkg}))
        .pipe(gulp.dest('./js/'));
});

gulp.task('build_withoutpromise', function() {
    var cmd = isWin ? 'r.js.cmd' : 'r.js';
    execSync(cmd + ' -o rjs_config.js');
});