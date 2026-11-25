"""Import the previously published, pinned module into this repository once."""
import argparse
from contextlib import nullcontext
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--archive', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
assert not (root / 'js/Bundle.js').exists(), 'Source import already completed'
expected = '5d2657afe4728618b808341a4d0be43e8afb58dc38f1360d7924d867a47a8418'
with (tempfile.TemporaryDirectory() if args.archive is None else nullcontext(None)) as temp:
    archive = args.archive
    if archive is None:
        subprocess.run(['gh', 'release', 'download', 'v2.19.7-cn.9', '--repo',
                        'DraculaCradle/plutonium-cn', '--pattern', 'plutonium-cn.zip', '--dir', temp], check=True)
        archive = Path(temp) / 'plutonium-cn.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, 'Baseline checksum mismatch'
    with zipfile.ZipFile(archive) as data:
        assert data.testzip() is None
        names = []
        for info in data.infolist():
            path = PurePosixPath(info.filename)
            assert not path.is_absolute() and '..' not in path.parts
            assert path.parts[0] == 'plutonium-cn' and not info.is_dir()
            relative = PurePosixPath(*path.parts[1:])
            assert relative.parts and relative.parts[0] not in ('.git', '.github', 'tools', 'dist')
            target = root.joinpath(*relative.parts)
            names.append(relative.as_posix())
            if relative.as_posix() in ('README.md', 'module.json', 'RELEASE-NOTES.md', 'LOCAL-ADAPTATION.md'):
                assert target.is_file(), relative
                continue
            assert not target.exists(), f'Unexpected existing file: {relative}'
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data.read(info))
    assert len(names) == 1452
    (root / 'tools/module-files.json').write_text(json.dumps(sorted(names), indent=2) + '\n', encoding='utf-8')
readme = root / 'README.md'
text = readme.read_text(encoding='utf-8')
text = text.replace('完整模块文件及源码随每个 Release 的 `plutonium-cn.zip` 发布；仓库根目录保存安装清单与说明，请使用清单或发行附件安装。',
                    '仓库保存完整模块源码；每个 Release 的 `plutonium-cn.zip` 为可安装版本。请使用固定清单或发行附件安装。后续提交版本更新后，GitHub Actions 会自动打包并发布。')
readme.write_text(text, encoding='utf-8')
print(f'Imported {len(names)} module files from verified cn.9 archive.')
