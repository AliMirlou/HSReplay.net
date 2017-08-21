import * as React from "react";
import { getCardUrl, getFragments } from "../helpers";
import Tooltip from "./Tooltip";

interface CardTileProps {
	card: any;
	count: number;
	customText?: string;
	disableTooltip?: boolean;
	height?: number;
	hideGem?: boolean;
	noLink?: boolean;
	countBoxSize?: number;
}

export default class CardTile extends React.Component<CardTileProps, {}> {
	public render(): JSX.Element {
		const baseHeight = 34;
		const baseCountWidth = this.props.countBoxSize || 24;
		const baseImageWidth = 134 + this.props.countBoxSize - 24;

		const showCountBox = this.props.count > 1 || this.props.card.rarity === "LEGENDARY";
		const countWidth = this.props.height / baseHeight * baseCountWidth;

		const tileStyle = {height: this.props.height + "px", lineHeight: this.props.height + "px"};
		const gemStyle = {width: this.props.height + "px"};
		const costStyle = {fontSize: this.props.height / baseHeight * 1.25 + "em"};
		const nameStyle = {fontSize: this.props.height / baseHeight * 0.9 + "em", width: "calc(100% - " + ((showCountBox ? countWidth : 0) + 4) + "px)"};

		const imageWidth = this.props.height / baseHeight * baseImageWidth;
		const imageRight = showCountBox ? (this.props.height / baseHeight * baseCountWidth - 2) + "px" : "0";
		const imageStyle = {width: imageWidth + "px", right: imageRight};

		let countBox = null;
		if (showCountBox) {
			const singleLegendary = this.props.card.rarity === "LEGENDARY" && this.props.count === 1;
			const countboxStyle = {width: countWidth + "px"};
			const countStyle = {fontSize: this.props.height / baseHeight * 1.15 + "em", top: singleLegendary ? "-2px" : 0};

			countBox = (
				<div className="card-countbox" style={countboxStyle}>
					<span className="card-count" style={countStyle}>{singleLegendary ? "★" : this.props.count}</span>
				</div>
			);
		}

		let gem = null;
		if (!this.props.hideGem) {
			const gemClassNames = ["card-gem"];
			gemClassNames.push("rarity-" + (this.props.card.rarity || "free").toLowerCase());

			gem = (
				<div className={gemClassNames.join(" ")} style={gemStyle}>
					<span className="card-cost" style={costStyle}>{this.props.card.cost}</span>
				</div>
			);
		}

		let tooltip = null;
		if (!this.props.disableTooltip) {
			tooltip = (
				<img
					className="card-image"
					src={"https://art.hearthstonejson.com/v1/render/latest/enUS/256x/" + this.props.card.id + ".png"}
				/>
			);
		}

		const label = this.props.customText || this.props.card.name;

		let tile = (
			<Tooltip content={tooltip} noBackground>
				<div
					className="card-tile"
					style={tileStyle}
					aria-label={label}
				>
					{gem}
					<div className="card-frame">
						<img
							className="card-asset"
							src={"https://art.hearthstonejson.com/v1/tiles/" + this.props.card.id + ".png"}
							style={imageStyle}
						/>
						{countBox}
						<span className={"card-fade-" + (showCountBox ? "countbox" : "no-countbox")} />
						<span className="card-name" style={nameStyle}>{label}</span>
					</div>
				</div>
			</Tooltip>
		);

		if (!this.props.noLink) {
			const url = getCardUrl(this.props.card) + getFragments(["gameType", "rankRange"]);
			tile = <a href={url}>{tile}</a>;
		}

		return tile;
	}
}
