import * as React from "react";
import { getArchetypeUrl } from "../../../helpers";
import Feature from "../../Feature";
import Tooltip from "../../Tooltip";
import DataInjector from "../../DataInjector";
import CardData from "../../../CardData";
import { ArchetypeRankPopularity } from "../../../interfaces";
import ArchetypeSignature from "../../archetypedetail/ArchetypeSignature";
import ArchetypeSignatureTooltip from "../ArchetypeSignatureTooltip";

interface RowHeaderProps extends React.ClassAttributes<RowHeader> {
	archetypeData?: ArchetypeRankPopularity;
	cardData: CardData;
	gameType: string;
	style?: any;
}

export default class RowHeader extends React.Component<RowHeaderProps, {}> {
	render() {
		return (
			<div className="matchup-row-header" style={this.props.style}>
				<div className="archetype">
					<div className="class-icon-wrapper">
						<img
							className="class-icon"
							src={`${STATIC_URL}images/64x/class-icons/${this.props.archetypeData.playerClass.toLowerCase()}.png`}
						/>
					</div>
					{this.renderName()}
				</div>
			</div>
		);
	}

	renderName(): JSX.Element | string {
		const {archetypeData} = this.props;
		if (archetypeData.id < 0) {
			return archetypeData.name;
		}
		return (
			<a
				href={getArchetypeUrl(archetypeData.id, archetypeData.name)}
				target="_blank"
			>
				<ArchetypeSignatureTooltip
					key={archetypeData.id}
					cardData={this.props.cardData}
					archetypeId={archetypeData.id}
					archetypeName={archetypeData.name}
					gameType={this.props.gameType}
				>
					<span className="archetype-name">{archetypeData.name}</span>
				</ArchetypeSignatureTooltip>
			</a>
		);
	}
}
