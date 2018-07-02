import {
	distanceInWords,
	distanceInWordsStrict,
	distanceInWordsToNow,
	format as fnsFormat,
} from "date-fns";
import fnsEn from "date-fns/locale/en";
import i18n, { InitOptions } from "i18next";
import CustomCallbackBackend from "i18next-callback-backend";
import ICU from "i18next-icu";
import numbro from "numbro";
import UserData from "./UserData";

export const I18N_NAMESPACE_FRONTEND = "frontend";
export const I18N_NAMESPACE_HEARTHSTONE = "hearthstone";

let dateFnsGlobalState = fnsEn;
function getFnsLocale(): object {
	return dateFnsGlobalState;
}

export function i18nDistanceInWords(
	dateToCompare: string | number | Date,
	date: string | number | Date,
	options?: object,
): string {
	options = options || {};
	options["locale"] = getFnsLocale();
	return distanceInWords(dateToCompare, date, options);
}

export function i18nDistanceInWordsStrict(
	dateToCompare: string | number | Date,
	date: string | number | Date,
	options?: object,
): string {
	options = options || {};
	options["locale"] = getFnsLocale();
	return distanceInWordsStrict(dateToCompare, date, options);
}

export function i18nDistanceInWordsToNow(
	dateToCompare: string | number | Date,
	options?: object,
): string {
	options = options || {};
	options["locale"] = getFnsLocale();
	return distanceInWordsToNow(dateToCompare, options);
}

export function i18nFormatDate(
	date: string | number | Date,
	format?: string,
): string {
	return fnsFormat(date, format, { locale: getFnsLocale() });
}

export function formatNumber(n: number, mantissa: number = 0): string {
	if (n === undefined || n === null) {
		return null;
	}
	return numbro(n).format({ thousandSeparated: true, mantissa });
}

// just used while we feature flag frontend translations
UserData.create();
if (UserData.hasFeature("frontend-translations")) {
	i18n.use(CustomCallbackBackend);
}

// create ICU so we can register locale-data later
const icu = new ICU();

// prettier-ignore
i18n
	.use(icu)
	.init({
		// keys as strings
		defaultNS: I18N_NAMESPACE_FRONTEND,
		fallbackNS: false,
		fallbackLng: false,
		keySeparator: false,
		lowerCaseLng: true,
		nsSeparator: false,

		// initial namespaces to load
		ns: ["frontend", "hearthstone"],

		// not required using i18next-react
		interpolation: {
			escapeValue: false,
		},

		// CustomCallbackBackend
		customLoad: async (language, namespace, callback) => {
			const translations = {};
			if (namespace === "translation") {
				// default fallback namespace, do not load
				callback(null, translations);
				return;
			}
			if (namespace === I18N_NAMESPACE_HEARTHSTONE) {
				try {
					/* By specifying the same webpackChunkName, all the files for one language are
				merged into a single module. This results in one network request per language */
					const modules = await Promise.all([
						import(/* webpackChunkName: "i18n/[index]" */ `./locale-data/${language}.ts`),
						import(/* webpackChunkName: "i18n/[index]" */ `i18n/${language}/hearthstone/global.json`),
						import(/* webpackChunkName: "i18n/[index]" */ `i18n/${language}/hearthstone/gameplay.json`),
						import(/* webpackChunkName: "i18n/[index]" */ `i18n/${language}/hearthstone/presence.json`),
					]);
					for (const [i, module] of modules.entries()) {
						if (!module) {
							continue;
						}
						// handle locale-data
						if (i === 0) {
							icu.addLocaleData(module.icu);
							numbro.registerLanguage(module.numbro, true);
							dateFnsGlobalState = module.dateFns;
							continue;
						}
						Object.assign(translations, module);
					}
				} catch (e) {
					console.error(e);
				}
			} else if (
				namespace === I18N_NAMESPACE_FRONTEND &&
				UserData.hasFeature("frontend-translations")
			) {
				try {
					Object.assign(
						translations,
						await import(/* webpackChunkName: "i18n/[index]" */ `i18n/${language}/frontend.json`),
					);
				} catch (e) {
					console.error(e);
				}
			}
			// pass translations to i18next
			callback(null, translations);
		},
	} as InitOptions);

export default i18n;
