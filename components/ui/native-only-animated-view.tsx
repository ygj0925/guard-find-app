import { Platform, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * This component is used to wrap animated views that should only be animated on native.
 * @param props - The props for the animated view.
 * @returns The animated view if the platform is native, otherwise the children.
 * @example
 * <NativeOnlyAnimatedView entering={FadeIn} exiting={FadeOut}>
 *   <Text>I am only animated on native</Text>
 * </NativeOnlyAnimatedView>
 */
type AnimatedViewProps = React.ComponentProps<typeof Animated.View> & {
  as?: 'View';
};
type AnimatedPressableProps = React.ComponentProps<typeof AnimatedPressable> & {
  as: 'Pressable';
};

function NativeOnlyAnimatedView(props: AnimatedViewProps | AnimatedPressableProps) {
  if (Platform.OS === 'web') {
    return <>{props.children as React.ReactNode}</>;
  }

  if (props.as === 'Pressable') {
    const { as: _as, key: _key, ...pressableProps } = props;
    return <AnimatedPressable {...pressableProps} />;
  }

  const { as: _as, ...viewProps } = props;
  return <Animated.View {...viewProps} />;
}

export { NativeOnlyAnimatedView };
