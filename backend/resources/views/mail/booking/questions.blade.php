{{-- Where customers go with questions. "Reply" only once replies reach someone: Reply-To is the
     owner's address (RENTAL_OWNER_EMAIL); without it they would land in the unread sender box. --}}
@if (config('rental.owner_email'))
Questions? Reply to this email, or call or text us at {{ config('rental.business.phone') }}.
@else
Questions? Call or text us at {{ config('rental.business.phone') }}.
@endif
