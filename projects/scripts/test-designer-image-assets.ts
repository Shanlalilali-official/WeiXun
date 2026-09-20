import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DESIGNER_IMAGE_ALLOWED_MIME_TYPES,
  DESIGNER_IMAGE_MAX_BYTES,
  detectDesignerImageMimeType,
  getDesignerImageAssetSlot,
  getDesignerImageAssetSlots,
  imageExtensionForMimeType,
  isAllowedDesignerImageMimeType,
} from '../src/lib/designer/image-assets';

const slots = getDesignerImageAssetSlots();
assert.equal(slots.length, 34, 'five introductions, twenty-five expressions and four scenes are registered');

const introductions = slots.filter((slot) => slot.category === 'person_intro');
assert.equal(introductions.length, 5, 'all five people retain an introduction image slot');
assert.ok(introductions.every((slot) => slot.imageUrl?.startsWith('/assets/people/')), 'introduction images retain the existing public assets');
assert.ok(introductions.every((slot) => slot.isDefault), 'existing introduction images are marked as defaults until replaced');

const expressions = slots.filter((slot) => slot.category === 'person_expression');
assert.equal(expressions.length, 25, 'each person has five expression slots');
assert.ok(expressions.every((slot) => slot.imageUrl === null), 'expression slots start empty');
assert.deepEqual(new Set(expressions.map((slot) => slot.slotKey.split(':').at(-1))), new Set(['angry', 'serious', 'calm', 'pleasant', 'very_happy']));

const scenes = slots.filter((slot) => slot.category === 'visit_scene');
assert.equal(scenes.length, 4, 'four visit-scene slots are registered');
assert.ok(scenes.every((slot) => slot.imageUrl === null), 'visit scenes start empty');
assert.deepEqual(scenes.map((slot) => slot.slotKey), ['visit_scene:office', 'visit_scene:restaurant', 'visit_scene:elevator', 'visit_scene:bar']);
assert.equal(getDesignerImageAssetSlot('person_intro:P1-001')?.imageUrl, '/assets/people/zhang-jianguo.png');
assert.equal(getDesignerImageAssetSlot('unregistered'), null, 'invented slots are rejected');

assert.equal(DESIGNER_IMAGE_MAX_BYTES, 5 * 1024 * 1024, 'file-size limit is five MB');
assert.deepEqual(DESIGNER_IMAGE_ALLOWED_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
assert.equal(isAllowedDesignerImageMimeType('image/png'), true);
assert.equal(isAllowedDesignerImageMimeType('image/gif'), false);
assert.equal(detectDesignerImageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
assert.equal(detectDesignerImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff])), 'image/jpeg');
assert.equal(detectDesignerImageMimeType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
assert.equal(detectDesignerImageMimeType(Uint8Array.from([1, 2, 3])), null);
assert.equal(imageExtensionForMimeType('image/jpeg'), 'jpg');

const migration = readFileSync(new URL('../supabase/migrations/20260917000100_designer_image_assets.sql', import.meta.url), 'utf8');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.designer_image_assets/);
assert.match(migration, /designer-image-assets/);
assert.match(migration, /file_size_limit = EXCLUDED\.file_size_limit/);
assert.match(migration, /person_expression:P1-00\[1-5\]/);

const designerPage = readFileSync(new URL('../src/app/designer/page.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(designerPage, /id: 'scenario' as const/, 'scene is no longer a separate top-level workspace');
assert.doesNotMatch(designerPage, /场景提示词/, 'unused scene prompt workspace is removed');
assert.match(designerPage, /selectedModule === 'assets'[\s\S]*拜访场景图片/, 'visit scenes are managed inside the asset library');
assert.match(designerPage, /setPreviewImageAsset\(asset\)/, 'uploaded images open the high-resolution preview');
assert.match(designerPage, /aria-modal="true"/, 'high-resolution preview uses an accessible modal');
console.log('designer image asset contracts passed');
