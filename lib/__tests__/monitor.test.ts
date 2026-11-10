import { maskDeep, maskSensitive } from '../monitor';

jest.mock('../api/client', () => ({ api: { post: jest.fn() } }));

describe('monitor 敏感值掩码', () => {
  it.each([
    ['13812345678', '138****5678'],
    ['138 1234 5678', '138****5678'],
    ['138-1234-5678', '138****5678'],
    ['+86 13812345678', '+86 138****5678'],
  ])('手机号 %s 被打码', (input, expected) => {
    expect(maskSensitive(`联系 ${input} 即可`)).toBe(`联系 ${expected} 即可`);
  });

  it('身份证样式只保留首尾段', () => {
    expect(maskSensitive('证件 11010519491231002X')).toBe('证件 110105********002X');
  });

  it('Authorization 头与 JSON 里的 token/password 字段被打码', () => {
    expect(maskSensitive('Authorization: abcdef123456789')).toBe('Authorization: abcdef****');
    expect(maskSensitive('{"token":"secret-value","password":"p@ss"}')).toBe(
      '{"token":"****","password":"****"}',
    );
  });

  it('深度掩码覆盖嵌套对象与数组里的字符串', () => {
    const masked = maskDeep({ list: ['13812345678'], nested: { note: '致电 13912345678' } }) as {
      list: string[];
      nested: { note: string };
    };
    expect(masked.list[0]).toBe('138****5678');
    expect(masked.nested.note).toBe('致电 139****5678');
  });
});
