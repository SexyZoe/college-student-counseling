const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const projectRoot = path.resolve(__dirname, '..')
const sourceExtensions = new Set(['.js', '.json', '.wxml', '.wxss'])
const ignoredDirectories = new Set(['.git', 'node_modules', 'miniprogram_npm'])

function collectSourceFiles(directory) {
  const files = []
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function(entry) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push.apply(files, collectSourceFiles(fullPath))
      return
    }
    if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath)
  })
  return files
}

const sourceFiles = collectSourceFiles(projectRoot)
const bomFiles = []
const syntaxErrors = []
const releaseUiErrors = []

sourceFiles.forEach(function(filePath) {
  const buffer = fs.readFileSync(filePath)
  const relativePath = path.relative(projectRoot, filePath)
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    bomFiles.push(relativePath)
  }
  if (path.extname(filePath) !== '.js') return
  try {
    new vm.Script(buffer.toString('utf8'), { filename: relativePath })
  } catch (error) {
    syntaxErrors.push(relativePath + ': ' + error.message)
  }
})

const forbiddenReleasePhrases = ['本地演示', '当前演示版', '正式版本需', '演示原型', '进入演示']
sourceFiles.filter(function(filePath) { return path.extname(filePath) === '.wxml' }).forEach(function(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  forbiddenReleasePhrases.forEach(function(phrase) {
    if (source.includes(phrase)) releaseUiErrors.push(path.relative(projectRoot, filePath) + ': ' + phrase)
  })
})

assert.deepEqual(bomFiles, [], '源码文件不能包含 UTF-8 BOM：\n' + bomFiles.join('\n'))
assert.deepEqual(syntaxErrors, [], 'JavaScript 语法检查失败：\n' + syntaxErrors.join('\n'))
assert.deepEqual(releaseUiErrors, [], '正式界面不能暴露演示版文案：\n' + releaseUiErrors.join('\n'))

console.log('✓ 源码文件无 UTF-8 BOM')
console.log('✓ 全部 JavaScript 文件语法有效')
console.log('✓ 正式界面未包含演示版提示')
console.log('\n源码完整性测试全部通过')
