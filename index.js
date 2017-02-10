var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var childProcess = require('child_process');
var pug = require('pug');

var PLANTUML_JAR = path.join(__dirname, 'vendor/plantuml.jar');
var pagePath = {};

function hashedImageName(content) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(content);
    return md5sum.digest('hex');
}

function getUmlPath(block, pagePath) {
    return path.join(pagePath.dir, block.kwargs.src);
}

function getUmlText(block, pagePath, log) {
    var umlPath = getUmlPath(block, pagePath)
    log.info('get plantUML content from path', umlPath);
    return fs.readFileSync(umlPath, 'utf8');
}

function generateUml(pagePath, imagePath, umlText) {
    childProcess.spawnSync('java', [
            '-Dplantuml.include.path=' + pagePath.dir,
            '-Djava.awt.headless=true',
            '-jar', PLANTUML_JAR,
            '-pipe',
            '-tsvg',
            '-charset', 'UTF-8'
        ],
        {
            // TODO: Extract stdout to a var and persist with this.output.writeFile
            stdio: ['pipe', fs.openSync(imagePath, 'w'), 'pipe'],
            input: umlText
        });
}

function createImage(imagePath, imageName) {
    const compiledFunction = pug.compileFile('template.pug');
    return compiledFunction({
        svg: fs.readFileSync(imagePath, 'utf-8'),
        link: path.join("/", imageName)
    })
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
                var umlText = getUmlText(block, pagePath, this.log);
                var imageName = hashedImageName(umlText) + '.svg';
                var imagePath = path.join(os.tmpdir(), imageName);

                generateUml(pagePath, imagePath, umlText);
                this.output.copyFile(imagePath, imageName);
                return createImage(imagePath, imageName)
            }
        }
    }
};
