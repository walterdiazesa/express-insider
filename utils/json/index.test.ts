import { colorizedJSON } from ".";

const mockExpenses = [
	{
		"id": "debd3d01-3dd5-6edd-9593-7166c8706e04",
		"title": "Spar",
		"purchaseDate": "2023-05-02T11:40:00.000Z",
		"type": "minus",
		"from": "CASH",
		"currency": "USD",
		"amount": "10",
		"orCurrency": null,
		"orAmount": null,
		"owner": "walterwalon@gmail.com",
		"categoryId": 2,
		"category": {
			"id": 2,
			"name": "🥖 Alimentos",
			"color": "F9CE58"
		}
	},
	{
		"id": "debd3d01-3dd5-6edd-9593-7166c8706e04",
		"title": "Spar",
		"purchaseDate": "2023-05-02T11:40:00.000Z",
		"type": "minus",
		"from": "CASH",
		"currency": "USD",
		"amount": "10",
		"orCurrency": null,
		"orAmount": null,
		"owner": "walterwalon@gmail.com",
		"categoryId": 2,
		"category": {
			"id": 2,
			"name": "🥖 Alimentos",
			"color": "F9CE58"
		}
	},
	{
		"id": "debd3d01-3dd5-6edd-9593-7166c8706e04",
		"title": "Spar",
		"purchaseDate": "2023-05-02T11:40:00.000Z",
		"type": "minus",
		"from": "CASH",
		"currency": "USD",
		"amount": "10",
		"orCurrency": null,
		"orAmount": null,
		"owner": "walterwalon@gmail.com",
		"categoryId": 2,
		"category": {
			"id": 2,
			"name": "🥖 Alimentos",
			"color": "F9CE58"
		}
	}
] as const;

describe('colorizedJSON', () => {
  it('should print mockExpenses with corresponding colors', () => {
    expect(colorizedJSON('    ', mockExpenses)).toMatchSnapshot()
  })
  it('should print object without property "n" with corresponding colors and single line', () => {
    expect((colorizedJSON('    ', { query: { title: 'spar', from: '20202', n: undefined }, params: { only: 2 } }, false))).toMatchSnapshot()
  })
  it('should print object without property "n" with corresponding colors and multi line', () => {
    expect((colorizedJSON('    ', { query: { title: 'spar', from: '20202', n: undefined }, params: { only: 2 } }, true))).toMatchSnapshot()
  })
})