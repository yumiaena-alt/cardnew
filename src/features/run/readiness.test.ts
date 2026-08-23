import { describe, expect, it } from 'vitest';
import type { PipelineEnv } from './readiness';
import { findMissingStages } from './readiness';

const complete: PipelineEnv = {
  TRIGGER_SECRET_KEY: 'tr_dev_key',
  RENDER_SERVICE_URL: 'https://render.example.com',
  RENDER_SERVICE_TOKEN: 'a'.repeat(40),
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  FAL_KEY: 'uuid:secret',
};

describe(findMissingStages, () => {
  it('reports nothing when every stage is configured', () => {
    expect(findMissingStages(complete)).toStrictEqual([]);
  });

  it('reports the queue when the worker key is absent', () => {
    expect(findMissingStages({ ...complete, TRIGGER_SECRET_KEY: undefined })).toStrictEqual([
      'queue',
    ]);
  });

  it('reports render when the service has a url but no token', () => {
    expect(findMissingStages({ ...complete, RENDER_SERVICE_TOKEN: undefined })).toStrictEqual([
      'render',
    ]);
  });

  it('reports storage when the service role key is absent', () => {
    expect(findMissingStages({ ...complete, SUPABASE_SERVICE_ROLE_KEY: undefined })).toStrictEqual([
      'storage',
    ]);
  });

  it('reports every missing stage at once', () => {
    expect(findMissingStages({})).toStrictEqual(['queue', 'render', 'storage']);
  });

  it('ignores the image model for card news, which never draws', () => {
    expect(findMissingStages({ ...complete, FAL_KEY: undefined })).toStrictEqual([]);
  });

  it('reports image generation when an instatoon run has no image key', () => {
    expect(findMissingStages({ ...complete, FAL_KEY: undefined }, 'toon')).toStrictEqual([
      'imagegen',
    ]);
  });
});
