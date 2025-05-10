// server/helpers/diningHelpers.js
import stringSimilarity from 'string-similarity';

export function deduplicateRestaurants(restaurants, threshold = 0.85) {
	const deduped = [];
	for (const candidate of restaurants) {
		const isDuplicate = deduped.some(existing => {
			const nameSim = stringSimilarity.compareTwoStrings(
				existing.name.toLowerCase(),
				candidate.name.toLowerCase()
				);
			const addressSim = existing.address && candidate.address
			? stringSimilarity.compareTwoStrings(
				existing.address.toLowerCase(),
				candidate.address.toLowerCase()
				)
			: 0;
			return nameSim >= threshold || (nameSim > 0.7 && addressSim > 0.7);
		});
		if (!isDuplicate) deduped.push(candidate);
	}
	return deduped;
}
