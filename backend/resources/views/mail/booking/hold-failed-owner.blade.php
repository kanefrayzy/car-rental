<x-mail::message>
# The deposit hold failed

The ${{ number_format($booking->deposit_usd) }} hold on **{{ $booking->name }}**'s card for the {{ $booking->car->full_name }} did not go through.

<x-mail::panel>
{{ $booking->hold_failure ?? 'The card was declined.' }}
</x-mail::panel>

<x-mail::table>
| | |
|:--|:--|
| Pick-up | {{ $booking->pickupLabel() }} |
| Return | {{ $booking->returnLabel() }} |
| Card | {{ $booking->card_label ?? 'Saved card' }} |
| Phone | {{ $booking->displayPhone() }} |
| Email | {{ $booking->email }} |
| Reference | {{ $booking->public_id }} |
</x-mail::table>

@if ($booking->hold_payment_intent_id && $booking->hold_expires_at)
This was a renewal. The current hold stays on the card until {{ \App\Models\Booking::etLabel($booking->hold_expires_at) }}. After that there is no hold unless the customer confirms the new one.

@endif
We emailed the customer a link to confirm the hold on their booking page, with the same card or another one. If they do, the admin panel shows On hold again.

**You decide** whether to hand over the car without the hold. You can also press Try hold again in the admin panel to try the saved card again.

<x-mail::button :url="route('filament.admin.resources.bookings.view', $booking)">
Open in the admin panel
</x-mail::button>

Reply to this message to write to the customer.
</x-mail::message>
