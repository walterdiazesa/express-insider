import { getRuntime } from '.';

describe('getRuntime', () => {
  it('Should return getRuntime as node (default to run tests)', async () => {
    const nodeRuntime = getRuntime();
    expect(nodeRuntime).toEqual({
      runtime: 'node',
      version: expect.stringMatching(/^(?:1[6-9]|[2-9]\d|\d{3,})\.\d+.\d+$/),
      trailCompatibility: '>=16.0.0'
    });
  });
})