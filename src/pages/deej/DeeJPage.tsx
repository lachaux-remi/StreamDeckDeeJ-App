import React from "react";

import DeejSlider from "@/components/deej/slider/DeejSlider";
import Page from "@/components/page/Page";
import { range } from "@/utils/ObjectUtil";

import "./DeeJ.scss";

const DeeJ = () => {
  return (
    <Page className="page__deej">
      <div className="deej">
        {range(0, 4).map(index => (
          <DeejSlider key={index} sliderIndex={index.toString()} />
        ))}
      </div>
    </Page>
  );
};

export default DeeJ;
