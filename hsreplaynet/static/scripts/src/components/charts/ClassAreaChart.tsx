import * as React from "react";
import {
	VictoryAxis, VictoryChart, VictoryContainer, VictoryLabel, VictoryLine,
	VictoryScatter, VictoryVoronoiTooltip, VictoryTooltip, VictoryArea, VictoryStack
} from "victory";
import {RenderData, RenderQueryData} from "../../interfaces";
import {getChartMetaData, toTimeSeries, toDynamicFixed, sliceZeros, getHeroColor, getChartScheme, toTitleCase} from "../../helpers";
import PopularityGradient from "./gradients/PopularityGradient";
import moment from "moment";

interface ClassAreaChartChartProps extends React.ClassAttributes<ClassAreaChartChart>{
	renderData: RenderData;
	widthRatio?: number;
}

export default class ClassAreaChartChart extends React.Component<ClassAreaChartChartProps, any> {
	render(): JSX.Element {
		const width = 150 * (this.props.widthRatio || 3);
		let content = null;

		if(this.props.renderData === "loading") {
			content = <VictoryLabel text={"Loading..."} style={{fontSize: 14}} textAnchor="middle" verticalAnchor="middle" x={width/2} y={75}/>
		}
		else if (this.props.renderData === "error") {
			content = <VictoryLabel text={"Please check back later"} style={{fontSize: 14}} textAnchor="middle" verticalAnchor="middle" x={width/2} y={75}/>
		}
		else if (this.props.renderData) {

			//semi mock data
			const seasonTicks = [
				new Date("2017-01-31T20:00:00").getTime(),
				new Date("2017-02-28T20:00:00").getTime(),
			];
			const areas = [];

			const classes = [
				"WARRIOR", "SHAMAN", "ROGUE",
				"PALADIN", "HUNTER", "DRUID",
				"WARLOCK", "MAGE", "PRIEST",
			];
			const dates = [
				"2017-01-30T00:00:00",
				"2017-02-06T00:00:00",
				"2017-02-13T00:00:00",
				"2017-02-20T00:00:00",
				"2017-02-27T00:00:00",
				"2017-03-06T00:00:00",
			]

			classes.sort();

			const scheme = getChartScheme("class");
			classes.forEach(playerClass => {
				const seriesData = (this.props.renderData as RenderQueryData).series.find(x => x.name === playerClass);
				const series = {name: playerClass, data: []};
				dates.forEach(date => {
					const point = seriesData && seriesData.data.find(x => x.game_date === date);
					series.data.push({x: new Date(date).getTime(), y: point ? point.num_games : 0});
				});
				const classColor = scheme[playerClass.toLowerCase()];
				areas.push (
					<VictoryArea
						data={series.data}
						style={{data: {fill: classColor.fill.replace("0.7", "0.6"), stroke: "rgba(0, 0, 0, 0.1)", strokeWidth: 0.5}}}
						interpolation="linear"
					/>
				);
			});

			content = [
				<VictoryChart
					height={150}
					width={width}
					domainPadding={{x: 0, y: 10}}
					padding={{left: 40, top: 30, right: 20, bottom: 30}}
					>
					<VictoryAxis
						scale="time"
						tickValues={seasonTicks}
						tickFormat={tick => moment(tick).add(1, "day").format("MMMM")}
						style={{axisLabel: {fontSize: 8}, tickLabels: {fontSize: 8}, grid: {stroke: "gray"}, axis: {visibility: "hidden"}}}
					/>
					<VictoryAxis
						dependentAxis
						axisLabelComponent={<VictoryLabel dx={10} />}
						style={{axisLabel: {fontSize: 8} ,tickLabels: {fontSize: 8}, grid: {stroke: d => d === 1000 ? "gray" : "lightgray"}, axis: {visibility: "hidden"}}}
					/>
					<VictoryStack>
						{areas}
					</VictoryStack>
				</VictoryChart>
			];	
		}
		return (
			<svg viewBox={"0 0 " + width + " 150"}>
				{content}
				<VictoryLabel text={"Games played - by week"} style={{fontSize: 10}} textAnchor="start" verticalAnchor="start" x={0} y={10}/>
			</svg>
		);
	}
}
