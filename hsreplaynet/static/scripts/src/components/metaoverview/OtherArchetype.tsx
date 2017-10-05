import * as React from "react";
import Tooltip from "../Tooltip";
import {ArchetypeData} from "../../interfaces";
import {toTitleCase} from "../../helpers";

interface OtherArchetypeProps extends React.ClassAttributes<OtherArchetype> {
	name: string;
	playerClass: string;
}

export default class OtherArchetype extends React.Component<OtherArchetypeProps, {}> {
	render(): JSX.Element {
		const {name, playerClass} = this.props;
		return (
			<Tooltip
				header={name}
				content={
					<p>
						This is a collection of all {toTitleCase(playerClass)} decks
						that do not fit into one of the popular archetypes.
						<br/><br/>No archetype details are available.
					</p>
				}
			>
				{name}
			</Tooltip>
		);
	}
}
