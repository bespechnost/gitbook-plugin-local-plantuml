var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var path = require('path');
var childProcess = require('child_process');
var Entities = require('html-entities').XmlEntities;
var marked = require('marked');

var PLANTUML_JAR = path.join(__dirname, 'vendor/plantuml.jar');

var entities = new Entities();
var pagePath = {};

function hashedImageName(content) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(content);
    return md5sum.digest('hex');
}

function parseUmlText(block, pagePath, log) {
    var umlPath = '';
    var umlText = '';

    if (block.kwargs.src) {
        umlPath = path.join(pagePath.dir, block.kwargs.src);
        log.info('get plantUML content from path', umlPath);
        umlText = fs.readFileSync(umlPath, 'utf8');
    } else {
        log.info('get plantUML content from context');
        umlText = entities.decode(block.body).replace(/(^[ \t]*\n)/gm, '');
        umlText = marked(umlText).replace(/^<p>/, '').replace(/<\/p>\n$/, '');
        umlText = entities.decode(umlText);
    }

    return umlText;
}

module.exports = {
    hooks: {
        'page:before': function (page) {
            pagePath = path.parse(page.rawPath);
        }
    },
    blocks: {
        plantuml: {
            process: function (block) {
                var umlText = parseUmlText(block, pagePath, this.log);
                var imageName = hashedImageName(umlText) + '.png';
                var imagePath = path.join(os.tmpdir(), imageName);
                var cwd = cwd || process.cwd();

                this.log.debug('using tempDir ', os.tmpdir());

                if (fs.existsSync(imagePath)) {
                    this.log.info('skipping plantUML image for ', imageName);
                } else {
                    this.log.info('rendering plantUML image to ', imageName);
                    childProcess.spawnSync('java', [
                            '-Dplantuml.include.path=' + cwd,
                            '-Djava.awt.headless=true',
                            '-jar', PLANTUML_JAR,
                            '-pipe'
                        ],
                        {
                            // TODO: Extract stdout to a var and persist with this.output.writeFile
                            stdio: ['pipe', fs.openSync(imagePath, 'w'), 'pipe'],
                            input: umlText
                        });
                }

                this.log.debug('copying plantUML from tempDir for ', imageName);

                this.output.copyFile(imagePath, imageName);

                return '<img src="' + path.join('/', imageName) + '"/>';
            }
        }
    }
};
