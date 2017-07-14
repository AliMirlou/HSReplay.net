import * as React from "react";
import {cardSorting, cleanText} from "../helpers";
import ObjectSearch, { Limit } from "./ObjectSearch";
import { ApiArchetype } from "../interfaces";

interface ArchetypeSearchState {
}

interface ArchetypeSearchProps {
	availableArchetypes: ApiArchetype[];
	selectedArchetypes?: ApiArchetype[];
	onArchetypeSelected?: (archetype: ApiArchetype) => void;
	onArchetypesChanged?: (archetypes: ApiArchetype[]) => void;
	id?: string;
	label?: string;
}

export default class ArchetypeSearch extends React.Component<ArchetypeSearchProps, ArchetypeSearchState> {
	render(): JSX.Element {
		return (
			<ArchetypeObjectSearch
				getFilteredObjects={(query) => this.getFilteredArchetypes(query)}
				getObjectElement={(archetype) => this.getArchetypeElement(archetype)}
				getObjectKey={(archetype) => "" + archetype.id}
				id={this.props.id}
				label={this.props.label}
				noDataText="No archetype found"
				objectLimit={Limit.SINGLE}
				onObjectsChanged={this.props.onArchetypesChanged}
				onObjectSelected={this.props.onArchetypeSelected}
				placeholder="Search for archetypes…"
				selectedObjects={this.props.selectedArchetypes}
				sorting={cardSorting}
				showOnFocus
			/>
		);
	}

	getFilteredArchetypes(query: string): ApiArchetype[] {
		if (!this.props.availableArchetypes) {
			return [];
		}
		if (!query) {
			return this.props.availableArchetypes;
		}
		const cleanQuery = cleanText(query);
		if (!cleanQuery) {
			return [];
		}
		return this.props.availableArchetypes.filter((archetype) => {
			return cleanText(archetype.name).indexOf(cleanQuery) !== -1;
		});
	}

	getArchetypeElement(archetype: ApiArchetype): JSX.Element {
		return (
			<div
				className={`player-class ${archetype.player_class.toLowerCase()}`}
			>
				{archetype.name}
			</div>
		);
	}
}

// tslint:disable-next-line:max-classes-per-file
class ArchetypeObjectSearch extends ObjectSearch<ApiArchetype> {
}
;
