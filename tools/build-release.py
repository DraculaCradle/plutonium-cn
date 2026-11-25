"""Build the Foundry release ZIP and separate manifest from an explicit module file list."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--repository', default='DraculaCradle/plutonium-cn')
parser.add_argument('--tag')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'module.json').read_text(encoding='utf-8'))
version = manifest['version']
tag = args.tag or f'v{version}'
assert tag == f'v{version}', 'Tag must match module.json version'
assert manifest['id'] == 'plutonium-cn'
repo = args.repository
manifest.update({
    'url': f'https://github.com/{repo}',
    'manifest': f'https://github.com/{repo}/releases/latest/download/module.json',
    'download': f'https://github.com/{repo}/releases/download/{tag}/plutonium-cn.zip',
    'bugs': f'https://github.com/{repo}/issues',
    'changelog': f'https://github.com/{repo}/releases/tag/{tag}',
})
files = json.loads((root / 'tools/module-files.json').read_text(encoding='utf-8'))
assert len(files) == len(set(files))
for name in files:
    assert name and not Path(name).is_absolute() and '..' not in Path(name).parts
    assert not name.startswith(('.git', 'tools/', 'dist/'))
    assert (root / name).is_file(), name
for resource in [manifest['readme'], *manifest['esmodules'], *manifest['styles'],
                 *(entry['path'] for entry in manifest['languages'])]:
    assert resource.removeprefix('./') in files, resource
dist = root / 'dist'
dist.mkdir(exist_ok=True)
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
(dist / 'module.json').write_bytes(manifest_bytes)
archive_path = dist / 'plutonium-cn.zip'
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in files:
        payload = manifest_bytes if name == 'module.json' else (root / name).read_bytes()
        archive.writestr(f'plutonium-cn/{name}', payload)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert archive.read('plutonium-cn/module.json') == manifest_bytes
    assert len(archive.namelist()) == len(files)
checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
(dist / 'plutonium-cn.zip.sha256').write_text(checksum + '  plutonium-cn.zip\n', encoding='ascii')
print(json.dumps({'version': version, 'files': len(files), 'bytes': archive_path.stat().st_size,
                  'sha256': checksum, 'manifest': manifest['manifest'], 'download': manifest['download']}, indent=2))
