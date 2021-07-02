import type React from "react";
import { useRef, useLayoutEffect } from "react";
import { animated, useSpring, config } from "@react-spring/web";
import useMeasure from "react-use-measure";
import { useDrag } from "react-use-gesture";
import { clamp } from "lodash";
import { BigButton, FlexItemStatic, FlexRow } from "../components/styled";

/**
 * This one works.
 *
 * I figured out the math behind keeping the scroller stationary when the window is resized.
 * I also learned that the initial config property of a gesture hook can accept a function.
 * Setting the initial value to the spring value will allow you to use just delta movements
 * instead of keeping the overall offset of a gesture function in check with outside influences
 * on the same spring. Beautiful.
 *
 * The next iteration would be code removal and condensing for clarity, but this one works for now.
 *
 */

// ITEMS
const colors: string[] = ["red", "blue", "green"];
const items: string[] = [...colors, ...colors, colors[0]];
// END ITEMS

function Slider({ spacing = 16 }) {
  const [containerRef, { width: cW }] = useMeasure(); // width of the container div.
  const [sliderRef, { width: sW }] = useMeasure(); // width of the slider div (sW > cW).

  const prevWidth = useRef(cW); // previous container width
  const offset = useRef(0); // spring offset

  const [spring, api] = useSpring(() => ({
    x: 0,
    config: {
      tension: items.length * 100,
      mass: 2,
      friction: 50
    }
  }));

  // update the spring opposite to shrinking / growing viewports to keep it still.
  // a useful thing to keep in mind is that offset will never be positive since it scrolls to the left
  useLayoutEffect(() => {
    const rightBound = cW - sW;
    const deltaR = cW - prevWidth.current; // resize delta
    if ((spring.x.get() >= 0 && deltaR < 0) || offset.current + deltaR >= 0) {
      // stick when shrinking || stick when growing
      offset.current = 0; // stick to left margin when screen size shrinks or grows.
    } else if (offset.current + deltaR <= rightBound) {
      offset.current = rightBound; // stick to the right margin on resize.
    } else {
      offset.current = offset.current + deltaR / 2; // resize from the middle
    }

    api.start({ x: offset.current, immediate: true });
    prevWidth.current = cW;
  }, [cW, sW, spring.x, api]);

  const bind = useDrag(
    ({ down, movement: [mx], initial: [initial], xy: [x], offset: [ox] }) => {
      /**
       * how to make gestures animate at a ratio that's not 1:1 with movement.
       * i.e. how to scroll N times the distance my finger moves.
       *
       * What you can't do:
       * 1. Multiply the movement or offset vectors by a static number. As soon as the gesture starts, it will just jump to that value on the next tick and then animate 1:1 from there.
       * 2. Multiply or add the movement vector by delta and add it to the movement vector. The animation will simply speed up or slow down based on the distance per tick, and it will be wonky.
       * 3. Use velocity: Same as 2: the animation will change speeds and not animate smoothly. The user will experience a wide fluctuation in movment if you can even wrangle the math to a useable algorithm.
       *
       * What you want:
       * A smoothly animating 2:1 or 0.5:1 ratio of movement, not something that fluctuates based on speed. Use velocity and decay for that (an intertial spring).
       *
       * So, to do this, multiply the distance the cursor has moved vs where it started by a scale factor, and then add it to the movement vector. Viola. Easy.
       *
       * Side notes: on first click (i.e. on the first 'down')...
       * - the distance will always be 0
       * - delta_x will equal mx because the previous movement === current movement this tick.
       * - on the next tick, the distance === mx and delta = mx - previous_mx (assuming you have the initial value set to remember where the spring is at all times like I do here)
       *
       * bugs: this algorithm only increases the scroll speed. It gets buggy when you try 0.5 : 1 ratios.
       */
      const scrollFactor = 1.5;
      const scrollAmount = mx - (scrollFactor - 1) * (initial - x);

      const bounds = {
        lb: 0,
        rb: cW - sW
      };

      const over = 150; // rubberband tolerance

      let _final: number;

      // TODO: implement decay functions to slow down the spring between crossing the bounds and hitting the over point.

      // rubberbanding
      if (scrollAmount > bounds.lb + over) {
        _final = over;
      } else if (scrollAmount < bounds.rb - over) {
        _final = bounds.rb - over;
      } else {
        _final = scrollAmount;
      }

      api.start({
        x: down ? _final : clamp(_final, bounds.rb, bounds.lb) // clamp ensures rubberbanding springs back to bounds.
        // immediate: down,
        // config: { velocity: vx, decay: true }
      });
      if (!down) {
        offset.current = clamp(_final, bounds.rb, bounds.lb); // at the end of every gesture, update the offset in case there is a resize.
      }
    },
    {
      bounds: { left: cW - sW, right: 0 }, // the direction of the drag is naturally mirrored, so right <- leftBound
      rubberband: 0.2,
      // change the reset value of mx to the current spring value (instead of [0,0]).
      // now mx can be used instead of ox to drive the gesture.
      // You would think you could use mx to track the movement and ox to drive the spring, but ox does not work well at all with resizing windows. Try it.
      // So, I use MX so that the scroller stays put when the window grows and shrinks
      initial: () => [spring.x.get(), 0],
      useTouch: true,
      experimental_preventWindowScrollY: true
    }
  );

  return (
    <FlexRow as={"main"}>
      <div
        className="container"
        ref={containerRef}
        style={{ position: "absolute", inset: 0, margin: spacing }}
      >
        <animated.div
          {...bind()}
          ref={sliderRef}
          style={{
            transform: spring.x.to((dx) => `translate3d(${dx}px, 0, 0)`),
            display: "inline-flex",
            overflow: "hidden"
          }}
          className="slidable-container"
        >
          {items.map((color: string, i: number) => (
            <FlexItemStatic className={`bg-${color}`} key={`item-${i}`}>
              <h1 className="no-select">{`0${i + 1}`}</h1>
            </FlexItemStatic>
          ))}
        </animated.div>
      </div>
    </FlexRow>
  );
}

export default function Iteration003() {
  const spacing = 16;
  const handleClick = (e: React.MouseEvent, action = "") => {
    e.preventDefault();
    console.log(`Action -- ${action}`);
  };

  return (
    <>
      <FlexRow className="bg-gray all-caps" as={"header"}>
        header
      </FlexRow>
      <Slider spacing={spacing} />
      <FlexRow
        className="controls"
        style={{ margin: `0 ${spacing}px ${spacing}px` }}
      >
        <BigButton
          spacing={spacing}
          onClick={(e) => handleClick(e, "previous")}
        >
          Previous
        </BigButton>
        <BigButton spacing={spacing} onClick={(e) => handleClick(e, "next")}>
          Next
        </BigButton>
      </FlexRow>
      <FlexRow className="bg-gray all-caps" as={"footer"}>
        footer
      </FlexRow>
    </>
  );
}
