import type { FieldDef, ViewDef } from './view.model';

describe('view model', () => {
  it('describes a form view as plain presentation data', () => {
    const f: FieldDef = { key: 'name', type: 'text', label: 'common.name', required: true };
    const v = { sections: [{ id: 's', columns: 2, fields: [f] }] } as unknown as ViewDef;
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
});
