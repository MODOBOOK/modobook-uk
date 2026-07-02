import * as React from "react";
import { Html, Text } from "@react-email/components";
import { BrandedShell, brandStyles, type BrandContext } from "./_branded-shell";

export type PractitionerMessageData = {
  brand: BrandContext;
  subject: string;
  bodyText: string; // plain text; converted to paragraphs
  preheader?: string;
};

export function PractitionerMessage(props: PractitionerMessageData) {
  const { brand } = props;
  const s = brandStyles(brand);
  const paragraphs = (props.bodyText || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <Html>
      <BrandedShell brand={brand} preview={props.preheader || props.subject}>
        <Text style={s.h1}>{props.subject}</Text>
        {paragraphs.map((p, i) => (
          <Text key={i} style={s.text}>
            {p.split("\n").map((line, j, arr) => (
              <React.Fragment key={j}>
                {line}
                {j < arr.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </Text>
        ))}
      </BrandedShell>
    </Html>
  );
}

export default PractitionerMessage;
