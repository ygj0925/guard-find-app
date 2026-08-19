import React from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const PATHS = {
  'house.fill': 'M3.5 10.25 12 3.5l8.5 6.75v9.25c0 .83-.67 1.5-1.5 1.5h-4.25v-5.5h-5.5V21H5c-.83 0-1.5-.67-1.5-1.5v-9.25ZM10.25 21v-5h3.5v5h-3.5Z',
  'paperplane.fill': 'M2.75 3.25 21.25 12 2.75 20.75l3.4-7.05-3.4-10.45Zm4.55 3.3 9.1 5.45-9.1 5.45 1.1-3.05h5.1v-2.8H8.4L7.3 6.55Z',
  'chevron.left.forwardslash.chevron.right': 'M8.05 4.4 15.65 12l-7.6 7.6-1.55-1.55L12.5 12 6.5 5.95 8.05 4.4Zm7.9 0 1.55 1.55L11.5 12l5.95 6.05-1.55 1.55L8.35 12l7.6-7.6Z',
  'chevron.right': 'M8.1 4.55 15.55 12 8.1 19.45 6.6 17.95 12.55 12 6.6 6.05 8.1 4.55Z',
} as const;

export type IconSymbolName = keyof typeof PATHS;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessibilityLabel={name}>
      <Path d={PATHS[name]} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );
}
