<x-mail::message>
# A deposit hold is still open

The ${{ number_format($booking->deposit_usd) }} hold on **{{ $booking->name }}**'s card is still on. The car was due back {{ $booking->returnLabel() }}.

@if ($booking->hold_expires_at)
The hold ends **{{ \App\Models\Booking::etLabel($booking->hold_expires_at) }}**. After that Stripe releases it on its own and nothing can be captured from it.

@endif
In the admin panel:

- **Release hold** if everything is fine. The customer gets an email.
- **Capture** up to ${{ number_format($booking->deposit_usd) }} for tolls, tickets, extra miles, late return, fuel or cleaning, with the reason. The rest is released.
- **Extra charge** later for anything the hold does not cover, such as tolls or tickets that arrive after the hold ends. It goes to the saved card{{ $booking->card_label ? ' ('.$booking->card_label.')' : '' }}.

<x-mail::button :url="route('filament.admin.resources.bookings.view', $booking)">
Open in the admin panel
</x-mail::button>

Reference: {{ $booking->public_id }}
</x-mail::message>
