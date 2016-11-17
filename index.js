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
            return page;
        }
    },
    blocks: {
        plantuml: {
            process: function (block) {
                var umlText = parseUmlText(block, pagePath, this.log);
                var imageName = hashedImageName(umlText) + '.svg';
                var imagePath = path.join(os.tmpdir(), imageName);
                var cwd = cwd || process.cwd();

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

                this.output.copyFile(imagePath, imageName);

                return `
                        <style>
                            .svg-schemes svg{
                                max-width: 100%;
                                display: block;
                                margin: 0 auto;
                                height: auto !important;
                            }
                            .svg-schemes svg *{
                                filter: none !important;
                            }
                            .svg-schemes p{
                                text-align: center;
                            }
                        </style>
                        <div class="svg-schemes">
                            ${fs.readFileSync(imagePath,'utf-8')}
                            <p><a href="${path.join("/", imageName)}" target="_blank">Open in a new tab.</a></p>
                        </div>
                        `;
            }
        }
    }
};
