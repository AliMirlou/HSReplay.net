import React from "react";
import {Visibility} from "../interfaces";
import {fetchCSRF} from "../helpers";

interface VisibilityDropdownProps {
	initial: Visibility;
	shortid: string;
}

interface VisibilityDropdownState {
	previous?: Visibility;
	selected?: Visibility;
	working?: boolean;
}

export default class PrivacyDropdown extends React.Component<VisibilityDropdownProps, VisibilityDropdownState> {

	constructor(props: VisibilityDropdownProps, context: any) {
		super(props, context);
		this.state = {
			previous: props.initial,
			selected: props.initial,
			working: false,
		};
	}

	render(): JSX.Element {
		let options = {
			Public: Visibility.Public,
			Unlisted: Visibility.Unlisted,
		};

		return <select
			onChange={(e: any) => {
				if (this.state.working) {
					return;
				}
				let selected = e.target.value;
				this.setState({
					selected,
				});
				const headers = new Headers();
				headers.set("content-type", "application/json");
				fetchCSRF("/api/v1/games/" + this.props.shortid + "/", {
					body: JSON.stringify({visibility: selected}),
					credentials: "same-origin",
					headers,
					method: "PATCH",
				})
				.then((response: Response) => {
					const statusCode = response.status;
					if(statusCode !== 200 && statusCode !== 204) {
						throw new Error("Unexpected status code " + statusCode + ", expected 200 or 204");
					}
					this.setState({previous: this.state.selected})
				})
				.catch(() => {
					alert("Could not change replay visibility.");
				})
				.then(() => this.setState({working: false}));
			}}
			value={"" + (+this.state.selected)}
			disabled={this.state.working}
		>{Object.keys(options).map((key: string) => <option value={"" + (+options[key])}>{key}</option>)}</select>;
	}
}
