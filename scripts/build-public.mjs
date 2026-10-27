import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');

const config = JSON.parse(
  await readFile(resolve(root, 'aleph.config.json'), 'utf8')
);

if (config.step !== 10) {
  throw new Error('aleph.config.json의 step을 10로 설정하세요.');
}

await mkdir(publicDir, { recursive: true });

// 이전에 생성된 공개 메모 파일을 제거합니다.
await rm(resolve(publicDir, 'data.json'), { force: true });

if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);

  await writeFile(
    resolve(publicDir, 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`,
    'utf8'
  );

  console.log('배포 식별 정보를 public/aleph.json에 기록했습니다.');
}

console.log('메모는 /api/notes에서 DB를 통해 제공합니다.');