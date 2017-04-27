import * as React from "react";
import CardTile from "./CardTile";
import {cleanText, slangToCardId} from "../helpers";

interface CardSearchState {
	cardSearchText?: string;
	cardSearchHasFocus?: boolean;
	cardSearchCount?: number;
	selectedIndex?: number;
}

interface CardSearchProps {
	availableCards: any[];
	id: string;
	onCardsChanged: (cards: any[]) => void;
	selectedCards: any[];
	label?: string;
}

export default class CardSearch extends React.Component<CardSearchProps, CardSearchState> {
	readonly defaultCardCount = 10;
	private search: HTMLDivElement;
	private input: HTMLInputElement;
	private cardlist: HTMLUListElement;

	constructor(props: CardSearchProps, state: CardSearchState) {
		super(props, state);
		this.state = {
			cardSearchCount: this.defaultCardCount,
			cardSearchHasFocus: false,
			cardSearchText: "",
			selectedIndex: 0,
		};
	}

	render(): JSX.Element {
		const cards = [];
		const matches = this.getFilteredCards(this.state.cardSearchText);
		matches.slice(0, this.state.cardSearchCount).forEach((card, index) => {
			const selected = this.state.selectedIndex === index;
			cards.push(
				<li
					className={selected ? "selected" : undefined}
					key={card.id}
					onMouseDown={(event) => {
						if (event.button !== 0) {
							event.preventDefault();
							return;
						}
						this.addCard(card);
					}}
					onMouseEnter={() => this.setState({selectedIndex: index})}
				>
					<CardTile card={card} count={1} height={34} rarityColored noLink/>
				</li>,
			);
		});

		if (this.state.cardSearchText && !matches.length) {
			cards.push(
				<li>
					<div className="search-message">No cards found</div>
				</li>,
			);
		}

		const onSearchScroll = (event: React.UIEvent<HTMLDivElement>) => {
			if (event.target["scrollTop"] + 200 >= event.target["scrollHeight"]) {
				if (matches.length > this.state.cardSearchCount) {
					this.setState({cardSearchCount: this.state.cardSearchCount + this.defaultCardCount});
				}
			}
		};

		let cardSearchResults = null;
		if (this.state.cardSearchHasFocus && cards.length && this.state.cardSearchText.length) {
			cardSearchResults = (
				<div className="card-search-results" onScroll={onSearchScroll} ref={(search) => this.search = search}>
					<ul ref={(ref) => this.cardlist = ref}>
						{cards}
					</ul>
				</div>
			);
		}

		let clear = null;
		if (this.state.cardSearchText) {
			clear = (
				<span
					className="glyphicon glyphicon-remove form-control-feedback"
					onClick={() => this.setState({cardSearchText: ""})}
				/>
			);
		}

		return (
			<div className="card-search search-wrapper">
				<div className="form-group has-feedback">
					<input
						id={this.props.id}
						aria-labelledby={this.props.label}
						ref={(input) => this.input = input}
						className="form-control"
						type="search"
						placeholder="Search…"
						onFocus={() => this.setState({cardSearchHasFocus: true})}
						onBlur={() => this.setState({cardSearchHasFocus: false})}
						value={this.state.cardSearchText}
						onChange={(e) => this.setState({cardSearchText: e.target["value"]})}
						onKeyDown={(e) => this.onKeyDown(e, cards.length)}
						aria-autocomplete="list"
					/>
					{clear}
				</div>
				{cardSearchResults}
				<ul>
					{this.getSelectedCards()}
				</ul>
			</div>
		);
	}

	addCard(card: any): void {
		const selected = this.props.selectedCards || [];
		if (selected.indexOf(card) === -1) {
			const newSelectedCards = selected.concat([card]);
			newSelectedCards.sort((a, b) => a["name"] > b["name"] ? 1 : -1);
			newSelectedCards.sort((a, b) => a["cost"] > b["cost"] ? 1 : -1);
			this.props.onCardsChanged(newSelectedCards);
		}
		this.setState({cardSearchText: "", cardSearchCount: this.defaultCardCount, selectedIndex: 0});
	};

	onKeyDown(event: React.KeyboardEvent<HTMLInputElement>, numCards: number): void {
		let height = 35;
		if (this.cardlist && this.cardlist.children && this.cardlist.children.length) {
			const child = this.cardlist.children[0];
			const bounds = child.getBoundingClientRect();
			height = bounds.height - 1;
		}
		switch (event.key) {
			case "ArrowDown":
				if (!this.search) {
					return;
				}
				this.setState({selectedIndex: Math.min(numCards - 1, this.state.selectedIndex + 1)});
				if (this.search["scrollTop"] === 0) {
					this.search["scrollTop"] += 5;
				}
				this.search["scrollTop"] += height;
				break;
			case "ArrowUp":
				if (!this.search) {
					return;
				}
				this.setState({selectedIndex: Math.max(0, this.state.selectedIndex - 1)});
				this.search["scrollTop"] -= height;
				break;
			case "Enter":
				const filteredCards = this.getFilteredCards(this.state.cardSearchText);
				if (!filteredCards.length) {
					return;
				}
				this.addCard(filteredCards[this.state.selectedIndex]);
				break;
		}
	}

	getFilteredCards(query: string): any[] {
		if (!this.props.availableCards) {
			return [];
		}
		const cleanQuery = cleanText(query);
		if (!cleanQuery) {
			return [];
		}
		const resultSet = [];
		let availableCards = this.props.availableCards;
		const slang = slangToCardId(cleanQuery);
		if (slang !== null) {
			availableCards = availableCards.filter((card) => {
				if (card.id === slang) {
					resultSet.push(card);
					return false;
				}
				return true;
			});
		}
		const filtered = availableCards.filter((card) => {
			if (!this.state.cardSearchText) {
				return true;
			}
			return cleanText(card.name).indexOf(cleanQuery) !== -1;
		});
		return resultSet.concat(filtered);
	}

	getSelectedCards(): JSX.Element[] {
		if (!this.props.selectedCards) {
			return null;
		}
		const selectedCards = [];
		this.props.selectedCards.forEach((card) => {
			const removeCard = () => {
				const newSelectedCards = this.props.selectedCards.filter((x) => x !== card);
				this.props.onCardsChanged(newSelectedCards);
			};
			selectedCards.push(
				<li
					onClick={removeCard}
					onKeyDown={(event) => {
						if([8, 13, 46].indexOf(event.which) === -1) {
							return;
						}
						removeCard();
						if(this.input) {
							this.input.focus();
						}
					}}
					tabIndex={0}
				>
					<div className="glyphicon glyphicon-remove" />
					<CardTile card={card} count={1} height={34} rarityColored noLink />
				</li>,
			);
		});
		return selectedCards;
	}
}
