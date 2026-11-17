import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, Pressable } from 'react-native';
import ReceiptScreen from '@/app/tools/ledger/receipts';
import { accountingApi } from '@/lib/api/endpoints/accounting';

const mockState = { token: 'first', phase: 'authenticated' };
const mockPush = jest.fn();
const mockToast = jest.fn();
const mockReload = jest.fn();
const mockRecognize = accountingApi.recognize as jest.Mock;
jest.mock('@/store/session', () => ({
  useSession: Object.assign(
    (select: (state: typeof mockState) => unknown) => select(mockState),
    { getState: () => mockState },
  ),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ groupId: '52' }),
}));
jest.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/lib/capabilities', () => ({
  imagePicker: { isAvailable: () => false },
}));
jest.mock('@/lib/api/endpoints/accounting', () => ({
  accountingApi: { receipts: jest.fn(), recognize: jest.fn() },
}));
jest.mock('@/hooks/useRequest', () => ({
  useRequest: () => ({ data: [], reload: mockReload }),
}));
jest.mock('lucide-react-native', () => ({}));
jest.mock('@/components/ui/text', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/ui/input', () => ({
  Input: require('react-native').TextInput,
}));
jest.mock('@/components/ui/card', () => ({
  Card: require('react-native').View,
}));
jest.mock('@/components/ui/button', () => ({
  Button: require('react-native').Pressable,
}));
jest.mock('@/components/business/feedback', () => ({
  EmptyState: () => null,
  ErrorState: () => null,
}));

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  mockState.phase = 'authenticated';
  mockState.token = 'first';
  mockRecognize.mockReset();
});
afterEach(() => {
  act(() => renderer?.unmount());
});
function buttons() {
  return renderer.root.findAllByType(Pressable);
}
async function open() {
  await act(async () => {
    renderer = TestRenderer.create(<ReceiptScreen />);
  });
}
async function enterText() {
  await act(async () =>
    renderer.root.findByType(TextInput).props.onChangeText('午饭35元'),
  );
}

it('recognition stays as a draft until the user explicitly opens the review form', async () => {
  mockRecognize.mockResolvedValue({
    type: 1,
    amount: 35,
    category: 'food',
    recordDate: '2026-11-17',
    remark: '午饭',
  });
  await open();
  await enterText();
  await act(async () => buttons()[0].props.onPress());
  expect(mockRecognize).toHaveBeenCalledWith(
    expect.objectContaining({ text: '午饭35元' }),
  );
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => buttons()[1].props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/tools/ledger/add',
    params: { groupId: '52', draft: expect.any(String) },
  });
});
it('a disabled provider surfaces its error and never fabricates a draft', async () => {
  mockRecognize.mockRejectedValue(new Error('识别服务尚未启用'));
  await open();
  await enterText();
  await act(async () => buttons()[0].props.onPress());
  expect(mockToast).toHaveBeenCalledWith('识别服务尚未启用', 'error');
  expect(mockPush).not.toHaveBeenCalled();
  expect(buttons()).toHaveLength(2);
});
it('an old account response cannot open or populate the next account form', async () => {
  let resolve!: (value: unknown) => void;
  mockRecognize.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await open();
  await enterText();
  await act(async () => buttons()[0].props.onPress());
  mockState.token = 'second';
  await act(async () => {
    renderer.update(<ReceiptScreen />);
  });
  await act(async () =>
    resolve({
      type: 1,
      amount: 35,
      category: 'food',
      recordDate: '2026-11-17',
      remark: '',
    }),
  );
  expect(mockPush).not.toHaveBeenCalled();
  expect(buttons()).toHaveLength(2);
});
