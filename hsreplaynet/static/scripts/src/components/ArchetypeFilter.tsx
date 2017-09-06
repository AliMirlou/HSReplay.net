import * as React from "react";
import InfoboxFilterGroup from "./InfoboxFilterGroup";
import InfoboxFilter from "./InfoboxFilter";
import UserData from "../UserData";

interface ArchetypeFilterProps extends React.ClassAttributes<ArchetypeFilter> {
	archetypes: any[];
	playerClasses: string[];
	selectedArchetypes: string[];
	archetypesChanged: (archetypes: string[]) => void;
	data?: any;
}

export default class ArchetypeFilter extends React.Component<ArchetypeFilterProps, {}> {
	render(): JSX.Element {
		const {archetypes, archetypesChanged, data, playerClasses, selectedArchetypes} = this.props;
		if (!data) {
			return null;
		}

		const filters = [];
		if (archetypes) {
			const addFilter = (archetypeId, playerClass, name) => {
				filters.push(
					<InfoboxFilter value={"" + archetypeId} >
						<span className={`player-class ${playerClass.toLowerCase()}`}>
							{name}
						</span>
					</InfoboxFilter>,
				);
			};
			const validPlayerClass = (archetype) => playerClasses.indexOf(archetype.playerClass) !== -1;

			archetypes.filter(validPlayerClass).map((archetype) => {
				const archetypeData = data.find((a) => "" + a.id === archetype.id);
				if (archetypeData) {
					addFilter(archetype.id, archetype.playerClass, archetypeData.name);
				}
			});
			playerClasses.forEach((playerClass) => {
				addFilter(-1, playerClass, "Other");
			});
		}

		if (filters.length === 0) {
			return null;
		}

		return (
			<div className="archetype-filter-wrapper">
				<InfoboxFilterGroup
					deselectable={true}
					selectedValue={selectedArchetypes.map(String)}
					onClick={(value, sender) => {
						if (value !== null && selectedArchetypes.indexOf(value) === -1) {
							archetypesChanged(selectedArchetypes.concat([value]));
						}
						else if (value === null) {
							archetypesChanged(selectedArchetypes.filter((x) => x !== sender));
						}
					}}
				>
					{filters}
				</InfoboxFilterGroup>
			</div>
		);
	}
}
