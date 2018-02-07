import { cookie } from "cookie_js";
import HearthstoneJSON, {
	CardData as HearthstoneJSONCardData
} from "hearthstonejson-client";
import UserData from "./UserData";

export default class CardData {
	private readonly byDbfId: { [dbfId: string]: HearthstoneJSONCardData } = {};
	private readonly byCardId: {
		[cardId: string]: HearthstoneJSONCardData;
	} = {};
	private readonly cards: HearthstoneJSONCardData[] = [];

	constructor(private modify?: (card: any) => void) {}

	public load(cb: (cardData: CardData) => void) {
		UserData.create();
		const locale = cookie.get("joust_locale", UserData.getLocale());
		const hsjson = new HearthstoneJSON();
		hsjson.getLatest(locale).then((data: any[]) => {
			data.forEach(card => {
				this.modify && this.modify(card);
				this.byDbfId[card.dbfId] = card;
				this.byCardId[card.id] = card;
				this.cards.push(card);
			});
			cb(this);
		});
	}

	public fromDbf(dbfId: number | string): HearthstoneJSONCardData {
		return this.byDbfId[+dbfId];
	}

	public fromCardId(cardId: string): HearthstoneJSONCardData {
		return this.byCardId[cardId];
	}

	public all(): HearthstoneJSONCardData[] {
		return this.cards;
	}
}
