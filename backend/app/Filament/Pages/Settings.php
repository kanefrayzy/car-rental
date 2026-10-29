<?php

namespace App\Filament\Pages;

use App\Support\SiteSettings;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

/**
 * Values the owner changes without a developer (user, 2026-10-16): the deposit for new
 * requests and the Instagram link. The website picks them up within a minute or two.
 */
class Settings extends Page
{
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static ?int $navigationSort = 20;

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'deposit_usd' => SiteSettings::depositUsd(),
            'instagram_url' => SiteSettings::instagramUrl(),
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->statePath('data')
            ->components([
                Section::make('Deposit')
                    ->description('Charged by card when a customer sends a request, refundable. Requests already sent keep the deposit they were made with. The website shows the new amount within a minute or two.')
                    ->schema([
                        TextInput::make('deposit_usd')
                            ->label('Deposit')
                            ->prefix('$')
                            ->integer()
                            // Stripe does not charge less than $0.50.
                            ->minValue(1)
                            ->maxValue(100000)
                            ->required(),
                    ]),
                Section::make('Instagram')
                    ->description('Shown in the footer and on the contact page. Leave it empty to hide it.')
                    ->schema([
                        TextInput::make('instagram_url')
                            ->label('Instagram link')
                            ->placeholder('https://www.instagram.com/yourpage')
                            ->url()
                            ->maxLength(255)
                            ->rule('regex:/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._\/?=&-]+$/')
                            ->validationMessages(['regex' => 'Paste the full link to the Instagram page, like https://www.instagram.com/yourpage']),
                    ]),
            ]);
    }

    public function content(Schema $schema): Schema
    {
        return $schema->components([
            Form::make([EmbeddedSchema::make('form')])
                ->id('form')
                ->livewireSubmitHandler('save')
                ->footer([
                    Actions::make([
                        Action::make('save')->label('Save')->submit('save')->keyBindings(['mod+s']),
                    ]),
                ]),
        ]);
    }

    public function save(): void
    {
        $state = $this->form->getState();

        SiteSettings::save((int) $state['deposit_usd'], $state['instagram_url'] ?? null);

        Notification::make()
            ->title('Saved')
            ->body('The website shows the change within a minute or two.')
            ->success()
            ->send();
    }
}
