| Rental | {{ $booking->days }} {{ Str::plural('day', $booking->days) }} × ${{ number_format($booking->price_per_day) }} = ${{ number_format($booking->total_usd) }} |
| Tax ({{ rtrim(rtrim(number_format($booking->tax_rate, 3), '0'), '.') }}%) | ${{ number_format($booking->tax_usd, 2) }} |
| Total | **${{ number_format($booking->totalWithTax(), 2) }}** |
